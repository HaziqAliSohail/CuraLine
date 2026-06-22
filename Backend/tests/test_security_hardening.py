"""Pre-deploy hardening checks: public endpoints don't leak PII, destructive
actions are audit-logged, and list endpoints are bounded."""
from models.appointment import Appointment
from models.audit_log import AuditLog


class TestPublicDoctorListingHidesPII:
    def test_list_excludes_contact_pii(self, client, sample_doctor):
        resp = client.get("/v1/doctors/")
        assert resp.status_code == 200
        for doc in resp.json():
            assert "email" not in doc
            assert "phone" not in doc
            # Professional fields are still present
            assert "specialization" in doc

    def test_detail_excludes_contact_pii(self, client, sample_doctor):
        # sample_doctor is APPROVED by default fixture
        resp = client.get(f"/v1/doctors/{sample_doctor.id}")
        assert resp.status_code == 200
        body = resp.json()
        assert "email" not in body
        assert "phone" not in body

    def test_doctor_sees_own_contact_in_self_profile(self, client, db):
        """A doctor's own /doctor/me still returns their contact details."""
        from datetime import time
        from models.doctor import Doctor
        from web.auth.security import ROLE_DOCTOR, create_access_token, hash_password
        d = Doctor(
            name="Dr. Self", gender="MALE", email="self@hospital.com", phone="+15550111",
            specialization="Cardiology", qualification="MD", availability_status="AVAILABLE",
            application_status="APPROVED", consultation_fee=100, reporting_time=time(9, 0),
            leaving_time=time(17, 0), password_hash=hash_password("selfpass1"),
        )
        db.add(d)
        db.commit()
        token = create_access_token(d.id, role=ROLE_DOCTOR)
        resp = client.get("/v1/doctor/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["email"] == "self@hospital.com"


class TestAuditLogging:
    def test_cancel_writes_audit(self, client, auth_header, sample_appointment, sample_patient, db):
        client.delete(f"/v1/appointments/{sample_appointment.id}", headers=auth_header)
        log = db.query(AuditLog).filter(AuditLog.action == "appointment.cancel").first()
        assert log is not None
        assert log.actor_role == "patient"
        assert log.actor_id == sample_patient.id
        assert log.target_id == sample_appointment.id

    def test_doctor_outcome_writes_audit(self, client, db, sample_patient, sample_doctor, sample_slot):
        from web.auth.security import ROLE_DOCTOR, create_access_token, hash_password
        sample_doctor.password_hash = hash_password("docpass1")
        appt = Appointment(
            patient_id=sample_patient.id, doctor_id=sample_doctor.id, slot_id=sample_slot.id,
            status=Appointment.SCHEDULED, severity_score=2,
        )
        db.add(appt)
        db.commit()
        token = create_access_token(sample_doctor.id, role=ROLE_DOCTOR)
        # sample_slot is tomorrow; outcome endpoint allows any SCHEDULED appt
        client.put(
            f"/v1/doctor/appointments/{appt.id}/outcome",
            headers={"Authorization": f"Bearer {token}"},
            json={"status": "COMPLETED"},
        )
        log = db.query(AuditLog).filter(AuditLog.action == "appointment.outcome_completed").first()
        assert log is not None
        assert log.actor_role == "doctor"
        assert log.actor_id == sample_doctor.id


class TestEmailMasking:
    def test_mask_email(self):
        from clients.emailer import mask_email
        assert mask_email("john.carter@example.com") == "j***@example.com"
        assert mask_email("a@b.com") == "a***@b.com"
        assert mask_email("") == "<redacted>"
        assert mask_email(None) == "<redacted>"
        assert mask_email("notanemail") == "<redacted>"


class TestListBounds:
    def test_doctor_list_rejects_oversized_limit(self, client):
        assert client.get("/v1/doctors/?limit=500").status_code == 422

    def test_doctor_list_accepts_pagination(self, client, sample_doctor):
        resp = client.get("/v1/doctors/?limit=10&offset=0")
        assert resp.status_code == 200
