"""Tests for the admin-initiated doctor invite flow:
invite → one-time link → doctor sets own password → signed in.
"""
from datetime import datetime, timedelta, timezone

import pytest

from clients import emailer
from models.doctor import Doctor


INVITE = {
    "name": "Dr. Invited",
    "gender": "FEMALE",
    "email": "invited@hospital.com",
    "specialization": "Pulmonology",
    "qualification": "MD Pulm",
}


@pytest.fixture(autouse=True)
def clean_outbox():
    emailer.OUTBOX.clear()
    yield
    emailer.OUTBOX.clear()


def _invite(client, admin_header, **overrides):
    return client.post("/v1/doctors/invite", headers=admin_header, json={**INVITE, **overrides})


class TestInviteCreation:
    def test_invite_creates_account_and_emails_link(self, client, admin_header, db):
        resp = _invite(client, admin_header)
        assert resp.status_code == 201
        body = resp.json()
        assert "/invite/" in body["invite_link"]
        assert body["expires_in_days"] == 7

        doctor = db.query(Doctor).filter(Doctor.email == INVITE["email"]).first()
        assert doctor.application_status == Doctor.APPROVED  # admin-vetted
        assert doctor.password_hash is None                  # no credentials yet
        assert doctor.invite_token is not None

        # Email contains the same link
        msgs = [m for m in emailer.OUTBOX if m["to"] == INVITE["email"]]
        assert len(msgs) == 1
        assert body["invite_link"] in msgs[0]["text"]

    def test_invited_doctor_cannot_login_before_accepting(self, client, admin_header):
        _invite(client, admin_header)
        resp = client.post("/v1/auth/doctor/login", json={
            "email": INVITE["email"], "password": "anything123",
        })
        assert resp.status_code == 401

    def test_duplicate_email_rejected(self, client, admin_header):
        assert _invite(client, admin_header).status_code == 201
        assert _invite(client, admin_header).status_code == 409

    def test_non_admin_cannot_invite(self, client, auth_header):
        resp = client.post("/v1/doctors/invite", headers=auth_header, json=INVITE)
        assert resp.status_code == 403


class TestInviteAcceptance:
    def _token_from_link(self, link):
        return link.rstrip("/").split("/")[-1]

    def test_full_accept_flow(self, client, admin_header, db):
        link = _invite(client, admin_header).json()["invite_link"]
        token = self._token_from_link(link)

        # Public info page knows who the invite is for
        info = client.get(f"/v1/auth/doctor/invite/{token}")
        assert info.status_code == 200
        assert info.json()["name"] == INVITE["name"]

        # Accept: set password, receive a signed-in portal token
        accept = client.post(f"/v1/auth/doctor/invite/{token}/accept", json={"password": "chosen-by-doc-1"})
        assert accept.status_code == 200
        portal_token = accept.json()["access_token"]

        me = client.get("/v1/doctor/me", headers={"Authorization": f"Bearer {portal_token}"})
        assert me.status_code == 200
        assert me.json()["name"] == INVITE["name"]

        # Normal login now works with the chosen password
        login = client.post("/v1/auth/doctor/login", json={
            "email": INVITE["email"], "password": "chosen-by-doc-1",
        })
        assert login.status_code == 200

    def test_token_is_single_use(self, client, admin_header):
        token = self._token_from_link(_invite(client, admin_header).json()["invite_link"])
        assert client.post(f"/v1/auth/doctor/invite/{token}/accept", json={"password": "chosen-by-doc-1"}).status_code == 200
        # Second use: token consumed
        assert client.post(f"/v1/auth/doctor/invite/{token}/accept", json={"password": "attacker-pass-1"}).status_code == 404
        assert client.get(f"/v1/auth/doctor/invite/{token}").status_code == 404

    def test_expired_token_rejected(self, client, admin_header, db):
        token = self._token_from_link(_invite(client, admin_header).json()["invite_link"])
        doctor = db.query(Doctor).filter(Doctor.email == INVITE["email"]).first()
        doctor.invite_expires_at = datetime.now(timezone.utc) - timedelta(days=1)
        db.commit()

        assert client.get(f"/v1/auth/doctor/invite/{token}").status_code == 410
        assert client.post(f"/v1/auth/doctor/invite/{token}/accept", json={"password": "chosen-by-doc-1"}).status_code == 410

    def test_unknown_token_404(self, client):
        assert client.get("/v1/auth/doctor/invite/not-a-real-token").status_code == 404

    def test_short_password_rejected(self, client, admin_header):
        token = self._token_from_link(_invite(client, admin_header).json()["invite_link"])
        assert client.post(f"/v1/auth/doctor/invite/{token}/accept", json={"password": "short"}).status_code == 422
