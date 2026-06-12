"""Integration tests for appointments and reschedule endpoints."""
from datetime import date, time, timedelta

from models.appointment import Appointment
from models.doctor_slot import DoctorSlot
from models.patient import Patient
from models.reschedule_request import RescheduleRequest
from web.auth.security import hash_password, create_access_token


class TestAppointmentsEndpoints:
    def test_list_appointments_empty(self, client, auth_header):
        resp = client.get("/v1/appointments/", headers=auth_header)
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list_appointments_with_data(self, client, auth_header, sample_appointment):
        resp = client.get("/v1/appointments/", headers=auth_header)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["reason"] == "Chest pain"
        assert data[0]["severity_score"] == 2

    def test_list_appointments_unauthenticated(self, client):
        resp = client.get("/v1/appointments/")
        assert resp.status_code == 401

    def test_get_appointment_by_id(self, client, auth_header, sample_appointment):
        resp = client.get(f"/v1/appointments/{sample_appointment.id}", headers=auth_header)
        assert resp.status_code == 200
        assert resp.json()["id"] == sample_appointment.id

    def test_get_appointment_not_found(self, client, auth_header):
        resp = client.get("/v1/appointments/9999", headers=auth_header)
        assert resp.status_code == 404

    def test_get_other_patients_appointment(self, client, sample_appointment, db):
        """Patient B should NOT be able to see Patient A's appointment."""
        other = Patient(
            name="Other",
            gender="MALE",
            email="other@test.com",
            password_hash=hash_password("securepass1"),
        )
        db.add(other)
        db.commit()
        token = create_access_token(other.id)
        resp = client.get(
            f"/v1/appointments/{sample_appointment.id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404  # Not found for this patient

    def test_update_appointment_status_cancel(self, client, auth_header, sample_appointment):
        resp = client.put(
            f"/v1/appointments/{sample_appointment.id}/status",
            headers=auth_header,
            json={"status": "CANCELLED"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "CANCELLED"

    def test_patient_cannot_mark_completed(self, client, auth_header, sample_appointment):
        """Visit outcomes belong to the doctor portal — patients may only cancel."""
        resp = client.put(
            f"/v1/appointments/{sample_appointment.id}/status",
            headers=auth_header,
            json={"status": "COMPLETED"},
        )
        assert resp.status_code == 403

    def test_update_appointment_invalid_status(self, client, auth_header, sample_appointment):
        resp = client.put(
            f"/v1/appointments/{sample_appointment.id}/status",
            headers=auth_header,
            json={"status": "INVALID"},
        )
        assert resp.status_code == 422

    def test_cancel_appointment(self, client, auth_header, sample_appointment, db):
        resp = client.delete(
            f"/v1/appointments/{sample_appointment.id}",
            headers=auth_header,
        )
        assert resp.status_code == 204
        # Verify slot is freed
        db.refresh(sample_appointment)
        assert sample_appointment.status == "CANCELLED"
        db.refresh(sample_appointment.slot)
        assert sample_appointment.slot.is_available is True

    def test_cancel_already_cancelled(self, client, auth_header, sample_appointment, db):
        sample_appointment.status = "CANCELLED"
        db.commit()
        resp = client.delete(
            f"/v1/appointments/{sample_appointment.id}",
            headers=auth_header,
        )
        assert resp.status_code == 409

    def test_cancel_completed_appointment(self, client, auth_header, sample_appointment, db):
        sample_appointment.status = "COMPLETED"
        db.commit()
        resp = client.delete(
            f"/v1/appointments/{sample_appointment.id}",
            headers=auth_header,
        )
        assert resp.status_code == 409

    def test_create_appointment_success(self, client, auth_header, sample_doctor, db):
        # Create a new slot
        slot = DoctorSlot(
            doctor_id=sample_doctor.id,
            date=date.today() + timedelta(days=1),
            start_time=time(10, 0),
            duration_minutes=30,
            is_available=True,
        )
        db.add(slot)
        db.commit()

        resp = client.post(
            "/v1/appointments/",
            headers=auth_header,
            json={"slot_id": slot.id, "reason": "General checkup"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["reason"] == "General checkup"
        assert data["slot_id"] == slot.id
        assert data["status"] == "SCHEDULED"

        # Verify slot is no longer available
        db.refresh(slot)
        assert slot.is_available is False

    def test_create_appointment_slot_not_found(self, client, auth_header):
        resp = client.post(
            "/v1/appointments/",
            headers=auth_header,
            json={"slot_id": 99999, "reason": "Test checkup"},
        )
        assert resp.status_code == 404
        assert resp.json()["detail"] == "Slot not found."

    def test_create_appointment_slot_unavailable(self, client, auth_header, sample_doctor, db):
        # Create an unavailable slot
        slot = DoctorSlot(
            doctor_id=sample_doctor.id,
            date=date.today() + timedelta(days=1),
            start_time=time(11, 0),
            duration_minutes=30,
            is_available=False,
        )
        db.add(slot)
        db.commit()

        resp = client.post(
            "/v1/appointments/",
            headers=auth_header,
            json={"slot_id": slot.id, "reason": "Urgent Checkup"},
        )
        assert resp.status_code == 409
        assert resp.json()["detail"] == "This slot is already booked or unavailable."


class TestRescheduleEndpoints:
    def _setup_reschedule(self, db, sample_appointment, sample_doctor):
        """Create a second patient with low-severity appointment and a reschedule request."""
        other_patient = Patient(
            name="Other Patient",
            gender="FEMALE",
            email="other@test.com",
            password_hash=hash_password("securepass1"),
        )
        db.add(other_patient)
        db.flush()

        proposed_slot = DoctorSlot(
            doctor_id=sample_doctor.id,
            date=date.today() + timedelta(days=2),
            start_time=time(14, 0),
        )
        db.add(proposed_slot)
        db.flush()

        target_appt = Appointment(
            patient_id=other_patient.id,
            doctor_id=sample_doctor.id,
            slot_id=proposed_slot.id,
            reason="Routine checkup",
            severity_score=1,
            reschedule_requested=True,
        )
        db.add(target_appt)
        db.flush()

        rr = RescheduleRequest(
            triggering_appointment_id=sample_appointment.id,
            target_appointment_id=target_appt.id,
            proposed_slot_id=proposed_slot.id,
        )
        db.add(rr)
        db.commit()
        return other_patient, target_appt, rr, proposed_slot

    def test_list_reschedule_requests(self, client, sample_appointment, sample_doctor, db):
        other_patient, target_appt, rr, _ = self._setup_reschedule(db, sample_appointment, sample_doctor)
        token = create_access_token(other_patient.id)
        resp = client.get(
            "/v1/reschedule/",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["status"] == "PENDING"

    def test_accept_reschedule(self, client, sample_appointment, sample_doctor, db):
        other_patient, target_appt, rr, proposed_slot = self._setup_reschedule(db, sample_appointment, sample_doctor)
        token = create_access_token(other_patient.id)
        resp = client.post(
            f"/v1/reschedule/{rr.id}/accept",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "ACCEPTED"

    def test_decline_reschedule(self, client, sample_appointment, sample_doctor, db):
        other_patient, target_appt, rr, _ = self._setup_reschedule(db, sample_appointment, sample_doctor)
        token = create_access_token(other_patient.id)
        resp = client.post(
            f"/v1/reschedule/{rr.id}/decline",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "DECLINED"

    def test_accept_reschedule_wrong_patient(self, client, sample_appointment, sample_doctor, auth_header, db):
        """Triggering patient should not be able to accept."""
        _, _, rr, _ = self._setup_reschedule(db, sample_appointment, sample_doctor)
        resp = client.post(
            f"/v1/reschedule/{rr.id}/accept",
            headers=auth_header,  # sample_patient, not target
        )
        assert resp.status_code == 403

    def test_accept_nonexistent_request(self, client, auth_header):
        resp = client.post("/v1/reschedule/9999/accept", headers=auth_header)
        assert resp.status_code == 404

    def test_double_accept(self, client, sample_appointment, sample_doctor, db):
        other_patient, _, rr, _ = self._setup_reschedule(db, sample_appointment, sample_doctor)
        token = create_access_token(other_patient.id)
        headers = {"Authorization": f"Bearer {token}"}
        # First accept
        client.post(f"/v1/reschedule/{rr.id}/accept", headers=headers)
        # Second accept should fail
        resp = client.post(f"/v1/reschedule/{rr.id}/accept", headers=headers)
        assert resp.status_code == 409
