"""SMS reminders (Twilio) + copay payment intents (Stripe) — sandbox behavior."""
from datetime import date, time, timedelta

from clients import sms
from clients.sms import OUTBOX
from models.appointment import Appointment
from models.doctor_slot import DoctorSlot


def test_send_sms_captured_in_test_mode():
    OUTBOX.clear()
    assert sms.send_sms("+15551234567", "hi") is True
    assert OUTBOX[-1]["to"] == "+15551234567"


def test_reminder_sends_sms_to_patients_with_phone(db, sample_patient, sample_doctor):
    from tasks.email_tasks import send_appointment_reminders
    OUTBOX.clear()
    slot = DoctorSlot(doctor_id=sample_doctor.id, date=date.today() + timedelta(days=1),
                      start_time=time(10, 0), duration_minutes=30, closes_before_minutes=15, is_available=False)
    db.add(slot); db.flush()
    db.add(Appointment(patient_id=sample_patient.id, doctor_id=sample_doctor.id, slot_id=slot.id,
                       status=Appointment.SCHEDULED, reason="checkup", severity_score=2))
    db.commit()

    import unittest.mock as m
    with m.patch("database.db.connection", return_value=db):
        original_close = db.close
        db.close = lambda: None
        try:
            send_appointment_reminders()
        finally:
            db.close = original_close

    # sample_patient has phone "1234567890" -> an SMS was queued.
    assert any(o["to"] == sample_patient.phone for o in OUTBOX)


def test_copay_checkout_sandbox_without_key(client, auth_header, sample_appointment):
    r = client.post(f"/v1/payments/appointments/{sample_appointment.id}/copay-checkout", headers=auth_header)
    assert r.status_code == 200
    body = r.json()
    assert body["enabled"] is False
    assert body["sandbox"] is True
    assert body["amount"] == 2500
    assert body["url"] is None


def test_copay_checkout_requires_own_appointment(client, db, sample_appointment):
    from models.patient import Patient
    from web.auth.security import hash_password, create_access_token
    other = Patient(name="Other", gender="MALE", email="other2@test.com",
                    password_hash=hash_password("securepass1"))
    db.add(other); db.commit()
    token = create_access_token(other.id)
    r = client.post(f"/v1/payments/appointments/{sample_appointment.id}/copay-checkout",
                    headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 404
