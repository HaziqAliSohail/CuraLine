"""PHI encryption at rest + patient data export/erasure."""
from sqlalchemy import text


def test_phi_encrypted_at_rest(db, monkeypatch):
    """With a key set, PHI is ciphertext in the DB but decrypts through the ORM."""
    from cryptography.fernet import Fernet
    from settings import settings as app_settings
    from models.patient import Patient
    from web.auth.security import hash_password

    monkeypatch.setattr(app_settings, "phi_encryption_key", Fernet.generate_key().decode())

    p = Patient(
        name="Enc", gender="MALE", email="enc@test.com",
        password_hash=hash_password("securepass1"),
        medical_history="Type 2 diabetes, on metformin",
    )
    db.add(p)
    db.commit()
    pid = p.id

    db.expire_all()
    reloaded = db.query(Patient).filter(Patient.id == pid).first()
    assert reloaded.medical_history == "Type 2 diabetes, on metformin"  # ORM decrypts

    raw = db.execute(text("SELECT medical_history FROM patients WHERE id=:i"), {"i": pid}).scalar()
    assert raw.startswith("enc::")
    assert "diabetes" not in raw  # plaintext never hits disk


def test_no_key_stores_plaintext(db):
    """Without a key, behavior is unchanged (dev/back-compat)."""
    from models.patient import Patient
    from web.auth.security import hash_password
    p = Patient(name="Plain", gender="MALE", email="plain@test.com",
                password_hash=hash_password("securepass1"), medical_history="asthma")
    db.add(p); db.commit()
    raw = db.execute(text("SELECT medical_history FROM patients WHERE id=:i"), {"i": p.id}).scalar()
    assert raw == "asthma"


def test_export_my_data(client, auth_header, sample_appointment):
    r = client.get("/v1/patients/me/export", headers=auth_header)
    assert r.status_code == 200
    body = r.json()
    assert body["profile"]["email"] == "patient@test.com"
    assert any(a["id"] == sample_appointment.id for a in body["appointments"])


def test_delete_my_account_purges_phi(client, auth_header, db, sample_patient, sample_appointment):
    r = client.delete("/v1/patients/me", headers=auth_header)
    assert r.status_code == 204

    db.expire_all()
    from models.patient import Patient
    from models.appointment import Appointment

    p = db.query(Patient).filter(Patient.id == sample_patient.id).first()
    assert p.name == "Deleted User"
    assert p.email != "patient@test.com"
    assert p.medical_history is None

    a = db.query(Appointment).filter(Appointment.id == sample_appointment.id).first()
    assert a.reason is None
    assert a.status == Appointment.CANCELLED  # future slot freed
