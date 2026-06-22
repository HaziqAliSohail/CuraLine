"""Consent gating: triage requires accepting the current disclaimer."""
from web.consent.router import CURRENT_CONSENT_VERSION


def _login(client, email="patient@test.com", password="securepass1"):
    r = client.post("/v1/auth/login", json={"email": email, "password": password})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_consent_status_and_accept(client, db):
    """A fresh (non-consented) patient sees accepted=false, can accept, then true."""
    from models.patient import Patient
    from web.auth.security import hash_password
    p = Patient(name="New", gender="MALE", email="new@test.com",
                password_hash=hash_password("securepass1"))
    db.add(p); db.commit()
    hdr = _login(client, "new@test.com")

    r = client.get("/v1/consent/", headers=hdr)
    assert r.status_code == 200
    body = r.json()
    assert body["accepted"] is False
    assert body["version"] == CURRENT_CONSENT_VERSION
    assert "911" in body["text"]

    r = client.post("/v1/consent/accept", headers=hdr)
    assert r.status_code == 200 and r.json()["accepted"] is True

    assert client.get("/v1/consent/", headers=hdr).json()["accepted"] is True


def test_inference_blocked_without_consent(client, db):
    """The triage endpoint refuses until consent is accepted."""
    from models.patient import Patient
    from web.auth.security import hash_password
    p = Patient(name="NoConsent", gender="MALE", email="nc@test.com",
                password_hash=hash_password("securepass1"))
    db.add(p); db.commit()
    hdr = _login(client, "nc@test.com")

    r = client.post("/v1/inference/", headers=hdr,
                    json={"message": "I have a headache", "conversation_history": [], "collected_fields": {}})
    assert r.status_code == 403
    assert r.json()["detail"]["code"] == "consent_required"

    client.post("/v1/consent/accept", headers=hdr)
    r = client.post("/v1/inference/", headers=hdr,
                    json={"message": "I have a headache", "conversation_history": [], "collected_fields": {}})
    assert r.status_code != 403


def test_consented_patient_passes_gate(client, auth_header):
    """The default sample_patient is consented in conftest, so triage isn't 403."""
    r = client.post("/v1/inference/", headers=auth_header,
                    json={"message": "I have a headache", "conversation_history": [], "collected_fields": {}})
    assert r.status_code != 403
