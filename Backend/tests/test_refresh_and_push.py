"""Tests for refresh-token auth (rotation, reuse detection, revocation) and
push-notification device registration + dispatch."""
import pytest

import database.db as dbmod
from clients import push
from models.device_token import DeviceToken
from models.refresh_token import RefreshToken
from web.auth.security import ROLE_DOCTOR, create_access_token, hash_password


@pytest.fixture(autouse=True)
def clean_push_outbox():
    push.OUTBOX.clear()
    yield
    push.OUTBOX.clear()


def _login(client):
    return client.post("/v1/auth/login", json={
        "email": "patient@test.com", "password": "securepass1",
    })


class TestRefreshTokens:
    def test_login_returns_refresh_token(self, client, sample_patient):
        body = _login(client).json()
        assert body["access_token"]
        assert body["refresh_token"]

    def test_refresh_rotates_tokens(self, client, sample_patient):
        first = _login(client).json()
        second = client.post("/v1/auth/refresh", json={"refresh_token": first["refresh_token"]})
        assert second.status_code == 200
        body = second.json()
        assert body["refresh_token"] != first["refresh_token"]

        # New access token works
        me = client.get("/v1/patients/me", headers={"Authorization": f"Bearer {body['access_token']}"})
        assert me.status_code == 200

    def test_old_refresh_token_dies_after_rotation(self, client, sample_patient):
        first = _login(client).json()
        client.post("/v1/auth/refresh", json={"refresh_token": first["refresh_token"]})
        # Using the rotated (old) token again must fail
        reused = client.post("/v1/auth/refresh", json={"refresh_token": first["refresh_token"]})
        assert reused.status_code == 401

    def test_reuse_detection_revokes_whole_family(self, client, sample_patient, db):
        first = _login(client).json()
        second = client.post("/v1/auth/refresh", json={"refresh_token": first["refresh_token"]}).json()
        # Attacker replays the old token → theft signal
        client.post("/v1/auth/refresh", json={"refresh_token": first["refresh_token"]})
        # The legitimate (newest) token is now dead too
        resp = client.post("/v1/auth/refresh", json={"refresh_token": second["refresh_token"]})
        assert resp.status_code == 401
        active = db.query(RefreshToken).filter(
            RefreshToken.subject_id == sample_patient.id,
            RefreshToken.revoked == False,  # noqa: E712
        ).count()
        assert active == 0

    def test_unknown_refresh_token_rejected(self, client):
        assert client.post("/v1/auth/refresh", json={"refresh_token": "garbage"}).status_code == 401

    def test_logout_revokes_token(self, client, sample_patient):
        body = _login(client).json()
        assert client.post("/v1/auth/logout", json={"refresh_token": body["refresh_token"]}).status_code == 204
        assert client.post("/v1/auth/refresh", json={"refresh_token": body["refresh_token"]}).status_code == 401

    def test_doctor_login_and_refresh_preserve_role(self, client, db):
        from models.doctor import Doctor
        from datetime import time
        d = Doctor(
            name="Dr. Refresh", gender="MALE", email="refresh@hospital.com",
            specialization="Cardiology", qualification="MD", availability_status="AVAILABLE",
            consultation_fee=100.00, reporting_time=time(9, 0), leaving_time=time(17, 0),
            password_hash=hash_password("doctorpass1"),
        )
        db.add(d)
        db.commit()

        login = client.post("/v1/auth/doctor/login", json={
            "email": "refresh@hospital.com", "password": "doctorpass1",
        }).json()
        refreshed = client.post("/v1/auth/refresh", json={"refresh_token": login["refresh_token"]}).json()
        me = client.get("/v1/doctor/me", headers={"Authorization": f"Bearer {refreshed['access_token']}"})
        assert me.status_code == 200

    def test_password_change_revokes_sessions(self, client, db):
        from models.doctor import Doctor
        from datetime import time
        d = Doctor(
            name="Dr. Rotate2", gender="MALE", email="rotate2@hospital.com",
            specialization="Cardiology", qualification="MD", availability_status="AVAILABLE",
            consultation_fee=100.00, reporting_time=time(9, 0), leaving_time=time(17, 0),
            password_hash=hash_password("originalpass1"),
        )
        db.add(d)
        db.commit()

        login = client.post("/v1/auth/doctor/login", json={
            "email": "rotate2@hospital.com", "password": "originalpass1",
        }).json()
        client.put("/v1/doctor/me/password",
                   headers={"Authorization": f"Bearer {login['access_token']}"},
                   json={"current_password": "originalpass1", "new_password": "newpassword2"})
        # Old refresh token is dead
        assert client.post("/v1/auth/refresh", json={"refresh_token": login["refresh_token"]}).status_code == 401


class TestPushDevices:
    TOKEN = "ExponentPushToken[test-device-0001]"

    def test_register_and_dispatch(self, client, auth_header, sample_patient, db):
        resp = client.post("/v1/notifications/devices", headers=auth_header,
                           json={"expo_push_token": self.TOKEN})
        assert resp.status_code == 204

        sent = push.notify_subject(db, sample_patient.id, "patient", "Hello", "World", {"k": "v"})
        assert sent == 1
        assert push.OUTBOX[0]["to"] == self.TOKEN
        assert push.OUTBOX[0]["title"] == "Hello"

    def test_reregister_rebinds_owner(self, client, auth_header, admin_header, sample_patient, sample_admin, db):
        client.post("/v1/notifications/devices", headers=auth_header, json={"expo_push_token": self.TOKEN})
        # Same physical device, different account signs in
        client.post("/v1/notifications/devices", headers=admin_header, json={"expo_push_token": self.TOKEN})
        rows = db.query(DeviceToken).filter(DeviceToken.expo_push_token == self.TOKEN).all()
        assert len(rows) == 1
        assert rows[0].subject_id == sample_admin.id

    def test_unregister(self, client, auth_header, sample_patient, db):
        client.post("/v1/notifications/devices", headers=auth_header, json={"expo_push_token": self.TOKEN})
        client.post("/v1/notifications/devices/unregister", headers=auth_header,
                    json={"expo_push_token": self.TOKEN})
        assert push.notify_subject(db, sample_patient.id, "patient", "x", "y") == 0

    def test_requires_auth(self, client):
        assert client.post("/v1/notifications/devices",
                           json={"expo_push_token": self.TOKEN}).status_code == 401

    def test_doctor_can_register(self, client, db):
        from models.doctor import Doctor
        from datetime import time
        d = Doctor(
            name="Dr. Push", gender="MALE", email="push@hospital.com",
            specialization="Cardiology", qualification="MD", availability_status="AVAILABLE",
            consultation_fee=100.00, reporting_time=time(9, 0), leaving_time=time(17, 0),
            password_hash=hash_password("doctorpass1"),
        )
        db.add(d)
        db.commit()
        token = create_access_token(d.id, role=ROLE_DOCTOR)
        resp = client.post("/v1/notifications/devices",
                           headers={"Authorization": f"Bearer {token}"},
                           json={"expo_push_token": "ExponentPushToken[doc-device]"})
        assert resp.status_code == 204
        assert push.notify_subject(db, d.id, "doctor", "t", "b") == 1


class _SessionShim:
    def __init__(self, session): self._s = session
    def __getattr__(self, n): return getattr(self._s, n)
    def commit(self): self._s.flush()
    def close(self): pass


class TestPushWiring:
    def test_reminder_sweep_pushes(self, client, auth_header, sample_patient, sample_doctor, db, monkeypatch):
        from datetime import date, time, timedelta
        from models.appointment import Appointment
        from models.doctor_slot import DoctorSlot
        from tasks.email_tasks import send_appointment_reminders

        client.post("/v1/notifications/devices", headers=auth_header,
                    json={"expo_push_token": self_token()})
        slot = DoctorSlot(doctor_id=sample_doctor.id, date=date.today() + timedelta(days=1),
                          start_time=time(9, 0), duration_minutes=30, is_available=False)
        db.add(slot)
        db.flush()
        db.add(Appointment(patient_id=sample_patient.id, doctor_id=sample_doctor.id,
                           slot_id=slot.id, status=Appointment.SCHEDULED, severity_score=2))
        db.commit()

        monkeypatch.setattr(dbmod, "connection", lambda: _SessionShim(db))
        send_appointment_reminders()

        titles = [m["title"] for m in push.OUTBOX]
        assert "Appointment tomorrow" in titles


def self_token():
    return "ExponentPushToken[reminder-device]"
