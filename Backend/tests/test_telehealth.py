"""Telehealth video room endpoint."""
import clients.video as video


def test_requires_auth(client, sample_appointment):
    assert client.get(f"/v1/telehealth/appointments/{sample_appointment.id}/video").status_code == 401


def test_sandbox_when_no_key(client, auth_header, sample_appointment):
    """Without DAILY_API_KEY the feature reports disabled (sandbox), not an error."""
    r = client.get(f"/v1/telehealth/appointments/{sample_appointment.id}/video", headers=auth_header)
    assert r.status_code == 200
    body = r.json()
    assert body["enabled"] is False
    assert body["sandbox"] is True


def test_creates_and_persists_room_with_key(client, auth_header, db, sample_appointment, monkeypatch):
    monkeypatch.setattr(video.settings, "daily_api_key", "k")
    monkeypatch.setattr(video, "_create_room", lambda name: f"https://curaline.daily.co/{name}")

    r = client.get(f"/v1/telehealth/appointments/{sample_appointment.id}/video", headers=auth_header)
    assert r.status_code == 200
    body = r.json()
    assert body["enabled"] is True
    assert body["url"].endswith(f"curaline-appt-{sample_appointment.id}")

    db.expire_all()
    from models.appointment import Appointment
    assert db.get(Appointment, sample_appointment.id).video_room_url == body["url"]


def test_other_patient_forbidden(client, db, sample_appointment):
    from models.patient import Patient
    from web.auth.security import hash_password, create_access_token
    other = Patient(name="Other", gender="MALE", email="other@test.com",
                    password_hash=hash_password("securepass1"))
    db.add(other); db.commit()
    token = create_access_token(other.id)
    r = client.get(f"/v1/telehealth/appointments/{sample_appointment.id}/video",
                   headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 403
