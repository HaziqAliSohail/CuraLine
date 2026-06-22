"""Multi-tenant trust chain: the platform verifies hospitals; verified hospitals
approve their own doctors; cross-tenant approval is blocked."""
from models.doctor import Doctor
from models.hospital import Hospital
from web.auth.security import create_access_token, ROLE_DOCTOR


def _apply_hospital(client, email="ops@stmary.org", name="St Mary Clinic", org_npi="1234567890"):
    return client.post("/v1/auth/hospital/apply", json={
        "hospital_name": name,
        "org_npi": org_npi,
        "address": "1 Health Way",
        "phone": "5551234567",
        "admin_name": "Hospital Admin",
        "admin_email": email,
        "admin_password": "Admin@1234",
    })


def _doctor_header(doctor_id):
    return {"Authorization": f"Bearer {create_access_token(doctor_id, role=ROLE_DOCTOR)}"}


def _apply_doctor(client, email, hospital_id=None):
    return client.post("/v1/auth/doctor/apply", json={
        "name": "Dr Jane Smith",
        "gender": "FEMALE",
        "email": email,
        "password": "Doctor@1234",
        "specialization": "Cardiology",
        "qualification": "MBBS",
        "license_number": "LIC-12345",
        "hospital_id": hospital_id,
    })


def test_hospital_apply_creates_pending_hospital_and_admin(client, db):
    resp = _apply_hospital(client)
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["hospital_status"] == Hospital.PENDING

    hospital = db.get(Hospital, body["hospital_id"])
    assert hospital.verification_status == Hospital.PENDING
    assert hospital.org_npi == "1234567890"

    admin = db.query(Doctor).filter(Doctor.email == "ops@stmary.org").first()
    assert admin.is_hospital_admin is True
    assert admin.application_status == Doctor.APPROVED  # can sign in immediately
    assert admin.hospital_id == hospital.id


def test_duplicate_admin_email_rejected(client):
    assert _apply_hospital(client).status_code == 201
    dup = _apply_hospital(client, name="Copycat Clinic")
    assert dup.status_code == 409


def test_platform_admin_verifies_hospital(client, db, admin_header):
    hid = _apply_hospital(client).json()["hospital_id"]

    pending = client.get("/v1/admin/hospitals?verification_status=PENDING", headers=admin_header)
    assert any(h["id"] == hid for h in pending.json())

    resp = client.put(f"/v1/admin/hospitals/{hid}/verification",
                       json={"action": "approve"}, headers=admin_header)
    assert resp.status_code == 200
    assert resp.json()["verification_status"] == Hospital.VERIFIED
    assert db.get(Hospital, hid).verification_status == Hospital.VERIFIED


def test_non_platform_cannot_verify_hospital(client, auth_header):
    """A regular patient (not is_admin) can't verify hospitals."""
    hid = _apply_hospital(client).json()["hospital_id"]
    resp = client.put(f"/v1/admin/hospitals/{hid}/verification",
                      json={"action": "approve"}, headers=auth_header)
    assert resp.status_code == 403


def test_verified_hospital_admin_approves_own_doctor(client, db, admin_header):
    hid = _apply_hospital(client).json()["hospital_id"]
    client.put(f"/v1/admin/hospitals/{hid}/verification",
               json={"action": "approve"}, headers=admin_header)
    admin = db.query(Doctor).filter(Doctor.is_hospital_admin == True).first()  # noqa: E712

    # A doctor applies to this hospital
    assert _apply_doctor(client, "dr.smith@stmary.org", hospital_id=hid).status_code == 201
    applicant = db.query(Doctor).filter(Doctor.email == "dr.smith@stmary.org").first()

    # Hospital admin sees only their hospital's pending applications and approves
    apps = client.get("/v1/doctors/applications", headers=_doctor_header(admin.id))
    assert apps.status_code == 200
    assert {a["id"] for a in apps.json()} == {applicant.id}

    decided = client.put(f"/v1/doctors/{applicant.id}/application",
                         json={"action": "approve"}, headers=_doctor_header(admin.id))
    assert decided.status_code == 200
    db.refresh(applicant)
    assert applicant.application_status == Doctor.APPROVED


def test_hospital_admin_cannot_approve_other_hospitals_doctor(client, db, admin_header):
    hid_a = _apply_hospital(client, email="a@a.org", name="Hospital A").json()["hospital_id"]
    hid_b = _apply_hospital(client, email="b@b.org", name="Hospital B", org_npi="9876543210").json()["hospital_id"]
    for hid in (hid_a, hid_b):
        client.put(f"/v1/admin/hospitals/{hid}/verification",
                   json={"action": "approve"}, headers=admin_header)
    admin_a = db.query(Doctor).filter(Doctor.email == "a@a.org").first()

    # Doctor applies to hospital B
    _apply_doctor(client, "dr.b@b.org", hospital_id=hid_b)
    doc_b = db.query(Doctor).filter(Doctor.email == "dr.b@b.org").first()

    resp = client.put(f"/v1/doctors/{doc_b.id}/application",
                     json={"action": "approve"}, headers=_doctor_header(admin_a.id))
    assert resp.status_code == 403
    db.refresh(doc_b)
    assert doc_b.application_status == Doctor.PENDING


def test_unverified_hospital_admin_cannot_approve(client, db):
    """Before the platform verifies the hospital, its admin has no authority."""
    hid = _apply_hospital(client).json()["hospital_id"]  # stays PENDING
    admin = db.query(Doctor).filter(Doctor.is_hospital_admin == True).first()  # noqa: E712
    _apply_doctor(client, "dr.x@stmary.org", hospital_id=hid)
    doc = db.query(Doctor).filter(Doctor.email == "dr.x@stmary.org").first()

    resp = client.put(f"/v1/doctors/{doc.id}/application",
                     json={"action": "approve"}, headers=_doctor_header(admin.id))
    assert resp.status_code == 403


def test_platform_admin_can_still_approve_any_doctor(client, db, admin_header):
    """Platform admin retains global authority (independents + any hospital)."""
    _apply_doctor(client, "indie@solo.org", hospital_id=None)
    doc = db.query(Doctor).filter(Doctor.email == "indie@solo.org").first()
    resp = client.put(f"/v1/doctors/{doc.id}/application",
                     json={"action": "approve"}, headers=admin_header)
    assert resp.status_code == 200
    db.refresh(doc)
    assert doc.application_status == Doctor.APPROVED


def test_hospital_admin_hidden_from_patient_directory(client, db, admin_header):
    hid = _apply_hospital(client).json()["hospital_id"]
    client.put(f"/v1/admin/hospitals/{hid}/verification",
               json={"action": "approve"}, headers=admin_header)
    listing = client.get("/v1/doctors/").json()
    emails_or_names = [d.get("name") for d in listing]
    assert "Hospital Admin" not in emails_or_names
