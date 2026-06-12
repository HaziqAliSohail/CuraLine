"""Tests for the email notification layer.

In TESTING mode the emailer captures messages in clients.emailer.OUTBOX
instead of talking to an SMTP server, so these tests assert on the outbox.
"""
from datetime import date, time, timedelta

import pytest

import database.db as dbmod
from clients import emailer
from models.appointment import Appointment
from models.doctor_slot import DoctorSlot


@pytest.fixture(autouse=True)
def clean_outbox():
    emailer.OUTBOX.clear()
    yield
    emailer.OUTBOX.clear()


def _outbox_for(to):
    return [m for m in emailer.OUTBOX if m["to"] == to]


APPLICATION = {
    "name": "Dr. Mailer",
    "gender": "MALE",
    "email": "mailer@newdoc.com",
    "password": "mailerpass1",
    "specialization": "Neurology",
    "qualification": "MD",
    "license_number": "LIC-MAIL-1",
}


class TestOnboardingEmails:
    def test_application_received_email(self, client):
        client.post("/v1/auth/doctor/apply", json=APPLICATION)
        msgs = _outbox_for("mailer@newdoc.com")
        assert len(msgs) == 1
        assert "received your CuraLine application" in msgs[0]["subject"]

    def test_approval_email(self, client, admin_header, db):
        client.post("/v1/auth/doctor/apply", json=APPLICATION)
        emailer.OUTBOX.clear()
        from models.doctor import Doctor
        doctor = db.query(Doctor).filter(Doctor.email == APPLICATION["email"]).first()

        client.put(
            f"/v1/doctors/{doctor.id}/application",
            headers=admin_header,
            json={"action": "approve"},
        )
        msgs = _outbox_for("mailer@newdoc.com")
        assert len(msgs) == 1
        assert "approved" in msgs[0]["subject"]

    def test_rejection_email(self, client, admin_header, db):
        client.post("/v1/auth/doctor/apply", json=APPLICATION)
        emailer.OUTBOX.clear()
        from models.doctor import Doctor
        doctor = db.query(Doctor).filter(Doctor.email == APPLICATION["email"]).first()

        client.put(
            f"/v1/doctors/{doctor.id}/application",
            headers=admin_header,
            json={"action": "reject"},
        )
        msgs = _outbox_for("mailer@newdoc.com")
        assert len(msgs) == 1
        assert "unable to approve" in msgs[0]["text"]


class TestAppointmentEmails:
    def test_booking_confirmation_email(self, client, auth_header, sample_patient, sample_slot):
        resp = client.post(
            "/v1/appointments/",
            headers=auth_header,
            json={"slot_id": sample_slot.id, "reason": "Checkup"},
        )
        assert resp.status_code == 201
        msgs = _outbox_for(sample_patient.email)
        assert len(msgs) == 1
        assert "confirmed" in msgs[0]["subject"]
        assert "Dr. Smith" in msgs[0]["text"]

    def test_cancellation_email(self, client, auth_header, sample_patient, sample_appointment):
        resp = client.delete(f"/v1/appointments/{sample_appointment.id}", headers=auth_header)
        assert resp.status_code == 204
        msgs = _outbox_for(sample_patient.email)
        assert len(msgs) == 1
        assert "cancelled" in msgs[0]["subject"]


class _SessionShim:
    """Adapts the test session so task-owned commit/close don't end the
    test transaction."""
    def __init__(self, session):
        self._s = session

    def __getattr__(self, name):
        return getattr(self._s, name)

    def commit(self):
        self._s.flush()

    def close(self):
        pass


class TestReminderSweep:
    @pytest.fixture()
    def tomorrow_appointment(self, db, sample_patient, sample_doctor):
        slot = DoctorSlot(
            doctor_id=sample_doctor.id,
            date=date.today() + timedelta(days=1),
            start_time=time(9, 30),
            duration_minutes=30,
            is_available=False,
        )
        db.add(slot)
        db.flush()
        appt = Appointment(
            patient_id=sample_patient.id,
            doctor_id=sample_doctor.id,
            slot_id=slot.id,
            status=Appointment.SCHEDULED,
            severity_score=2,
        )
        db.add(appt)
        db.commit()
        db.refresh(appt)
        return appt

    def test_reminder_sent_once(self, db, sample_patient, tomorrow_appointment, monkeypatch):
        from tasks.email_tasks import send_appointment_reminders
        monkeypatch.setattr(dbmod, "connection", lambda: _SessionShim(db))

        sent = send_appointment_reminders()
        assert sent == 1
        msgs = _outbox_for(sample_patient.email)
        assert len(msgs) == 1
        assert "tomorrow" in msgs[0]["subject"]

        db.refresh(tomorrow_appointment)
        assert tomorrow_appointment.reminder_sent is True

        # Idempotent: second sweep sends nothing
        assert send_appointment_reminders() == 0
        assert len(_outbox_for(sample_patient.email)) == 1

    def test_no_reminder_for_cancelled(self, db, sample_patient, tomorrow_appointment, monkeypatch):
        from tasks.email_tasks import send_appointment_reminders
        monkeypatch.setattr(dbmod, "connection", lambda: _SessionShim(db))

        tomorrow_appointment.status = Appointment.CANCELLED
        db.commit()

        assert send_appointment_reminders() == 0
        assert _outbox_for(sample_patient.email) == []


class TestRescheduleEmail:
    def test_reschedule_notification_emails_target(self, db, sample_appointment, sample_patient, monkeypatch):
        from models.reschedule_request import RescheduleRequest
        from tasks.chat_tasks import send_reschedule_notification
        monkeypatch.setattr(dbmod, "connection", lambda: _SessionShim(db))

        req = RescheduleRequest(
            triggering_appointment_id=sample_appointment.id,
            target_appointment_id=sample_appointment.id,
            proposed_slot_id=sample_appointment.slot_id,
            status=RescheduleRequest.PENDING,
        )
        db.add(req)
        db.commit()

        send_reschedule_notification(req.id)

        msgs = _outbox_for(sample_patient.email)
        assert len(msgs) == 1
        assert "critical patient" in msgs[0]["subject"].lower()


class TestEmailerSafety:
    def test_send_email_without_recipient_is_noop(self):
        assert emailer.send_email("", "subject", "body") is False
        assert emailer.OUTBOX == []

    def test_testing_mode_captures_instead_of_sending(self):
        assert emailer.send_email("someone@test.com", "Hi", "Body") is True
        assert emailer.OUTBOX[-1]["subject"] == "Hi"
