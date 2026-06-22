"""Email verification + password reset flows."""
from clients.emailer import OUTBOX


def _token_after(fragment):
    """Pull the single-use token out of the most recent matching email."""
    for m in reversed(OUTBOX):
        if fragment in m["text"]:
            return m["text"].split(fragment)[1].split()[0].strip()
    return None


def _register(client, email="newuser@test.com"):
    return client.post("/v1/auth/register", json={
        "name": "New User", "gender": "FEMALE", "email": email,
        "password": "securepass1",
    })


def test_register_sends_verification_and_verify_works(client, db):
    OUTBOX.clear()
    r = _register(client)
    assert r.status_code == 201
    assert r.json()["email_verified"] is False

    token = _token_after("/verify-email/")
    assert token, "verification email was not sent"

    r = client.post("/v1/auth/verify-email", json={"token": token})
    assert r.status_code == 200 and r.json()["verified"] is True

    from models.patient import Patient
    p = db.query(Patient).filter(Patient.email == "newuser@test.com").first()
    assert p.email_verified is True


def test_invalid_verify_token_rejected(client):
    r = client.post("/v1/auth/verify-email", json={"token": "not-a-real-token"})
    assert r.status_code == 400


def test_forgot_and_reset_password(client, db):
    OUTBOX.clear()
    _register(client, "reset@test.com")

    r = client.post("/v1/auth/forgot-password", json={"email": "reset@test.com"})
    assert r.status_code == 200

    token = _token_after("/reset-password/")
    assert token, "reset email was not sent"

    r = client.post("/v1/auth/reset-password", json={"token": token, "new_password": "brandnewpass2"})
    assert r.status_code == 200

    # New password works; old one no longer does.
    assert client.post("/v1/auth/login", json={"email": "reset@test.com", "password": "brandnewpass2"}).status_code == 200
    assert client.post("/v1/auth/login", json={"email": "reset@test.com", "password": "securepass1"}).status_code == 401


def test_forgot_password_unknown_email_does_not_leak(client):
    OUTBOX.clear()
    r = client.post("/v1/auth/forgot-password", json={"email": "nobody@nowhere.com"})
    assert r.status_code == 200  # same response as a real address
    assert _token_after("/reset-password/") is None  # no email actually sent


def test_invalid_reset_token_rejected(client):
    r = client.post("/v1/auth/reset-password", json={"token": "bogus", "new_password": "whatever12"})
    assert r.status_code == 400
