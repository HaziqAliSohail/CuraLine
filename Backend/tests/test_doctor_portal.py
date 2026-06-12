"""Tests for the doctor portal: doctor auth, role separation, day schedule,
visit outcomes, slot self-service (single + bulk), morning briefing, and
reschedule visibility."""
from datetime import date, time, timedelta

import pytest

from models.appointment import Appointment
from models.doctor import Doctor
from models.doctor_slot import DoctorSlot
from models.patient import Patient
from models.reschedule_request import RescheduleRequest
from web.auth.security import ROLE_DOCTOR, create_access_token, hash_password


@pytest.fixture()
def portal_doctor(db):
    d = Doctor(
        name="Dr. Portal",
        gender="FEMALE",
        email="portal@hospital.com",
        specialization="Cardiology",
        qualification="MD",
        availability_status="AVAILABLE",
        consultation_fee=100.00,
        reporting_time=time(9, 0),
        leaving_time=time(17, 0),
        password_hash=hash_password("doctorpass1"),
    )
    db.add(d)
    db.commit()
    db.refresh(d)
    return d


@pytest.fixture()
def doctor_header(portal_doctor):
    token = create_access_token(portal_doctor.id, role=ROLE_DOCTOR)
    return {"Authorization": f"Bearer {token}"}


def _today_slot(db, doctor_id, start, available=False):
    s = DoctorSlot(
        doctor_id=doctor_id,
        date=date.today(),
        start_time=start,
        duration_minutes=30,
        is_available=available,
    )
    db.add(s)
    db.flush()
    return s


def _appointment(db, patient_id, doctor_id, slot_id, severity=2, reason="Checkup"):
    a = Appointment(
        patient_id=patient_id,
        doctor_id=doctor_id,
        slot_id=slot_id,
        status=Appointment.SCHEDULED,
        reason=reason,
        severity_score=severity,
    )
    db.add(a)
    db.flush()
    return a


class TestDoctorAuth:
    def test_doctor_login_success(self, client, portal_doctor):
        resp = client.post(
            "/v1/auth/doctor/login",
            json={"email": "portal@hospital.com", "password": "doctorpass1"},
        )
        assert resp.status_code == 200
        assert "access_token" in resp.json()

    def test_doctor_login_wrong_password(self, client, portal_doctor):
        resp = client.post(
            "/v1/auth/doctor/login",
            json={"email": "portal@hospital.com", "password": "wrongpass1"},
        )
        assert resp.status_code == 401

    def test_doctor_without_credentials_cannot_login(self, client, sample_doctor):
        """Doctors created without a password have no portal access."""
        resp = client.post(
            "/v1/auth/doctor/login",
            json={"email": sample_doctor.email, "password": "anything123"},
        )
        assert resp.status_code == 401

    def test_patient_token_rejected_on_doctor_routes(self, client, auth_header):
        resp = client.get("/v1/doctor/me", headers=auth_header)
        assert resp.status_code == 401

    def test_doctor_token_rejected_on_patient_routes(self, client, doctor_header):
        resp = client.get("/v1/patients/me", headers=doctor_header)
        assert resp.status_code == 401

    def test_doctor_me(self, client, doctor_header):
        resp = client.get("/v1/doctor/me", headers=doctor_header)
        assert resp.status_code == 200
        assert resp.json()["name"] == "Dr. Portal"

    def test_admin_provisions_doctor_with_password(self, client, admin_header, db):
        resp = client.post("/v1/doctors/", headers=admin_header, json={
            "name": "Dr. New",
            "gender": "MALE",
            "email": "new@hospital.com",
            "specialization": "Neurology",
            "qualification": "MD",
            "consultation_fee": 120,
            "reporting_time": "09:00:00",
            "leaving_time": "17:00:00",
            "password": "newdocpass1",
        })
        assert resp.status_code == 201
        login = client.post(
            "/v1/auth/doctor/login",
            json={"email": "new@hospital.com", "password": "newdocpass1"},
        )
        assert login.status_code == 200

    def test_provisioning_password_requires_email(self, client, admin_header):
        resp = client.post("/v1/doctors/", headers=admin_header, json={
            "name": "Dr. NoEmail",
            "gender": "MALE",
            "specialization": "Neurology",
            "qualification": "MD",
            "consultation_fee": 120,
            "reporting_time": "09:00:00",
            "leaving_time": "17:00:00",
            "password": "newdocpass1",
        })
        assert resp.status_code == 422


class TestDoctorSchedule:
    def test_day_view_ordered_with_patient_intel(self, client, doctor_header, portal_doctor, sample_patient, db):
        s2 = _today_slot(db, portal_doctor.id, time(14, 0))
        s1 = _today_slot(db, portal_doctor.id, time(9, 0))
        _appointment(db, sample_patient.id, portal_doctor.id, s2.id, severity=2, reason="Follow-up")
        _appointment(db, sample_patient.id, portal_doctor.id, s1.id, severity=5, reason="Chest pain")
        db.commit()

        resp = client.get("/v1/doctor/appointments", headers=doctor_header)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        assert data[0]["slot_time"] == "09:00:00"  # time-ordered
        assert data[0]["severity_score"] == 5
        assert data[0]["patient_name"] == sample_patient.name
        assert data[0]["patient_medical_history"] == sample_patient.medical_history

    def test_day_view_excludes_other_doctors(self, client, doctor_header, sample_doctor, sample_patient, db):
        slot = _today_slot(db, sample_doctor.id, time(10, 0))
        _appointment(db, sample_patient.id, sample_doctor.id, slot.id)
        db.commit()
        resp = client.get("/v1/doctor/appointments", headers=doctor_header)
        assert resp.json() == []

    def test_record_outcome_completed(self, client, doctor_header, portal_doctor, sample_patient, db):
        slot = _today_slot(db, portal_doctor.id, time(9, 0))
        appt = _appointment(db, sample_patient.id, portal_doctor.id, slot.id)
        db.commit()
        resp = client.put(
            f"/v1/doctor/appointments/{appt.id}/outcome",
            headers=doctor_header,
            json={"status": "COMPLETED"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "COMPLETED"

    def test_cannot_record_outcome_for_other_doctor(self, client, doctor_header, sample_appointment):
        resp = client.put(
            f"/v1/doctor/appointments/{sample_appointment.id}/outcome",
            headers=doctor_header,
            json={"status": "COMPLETED"},
        )
        assert resp.status_code == 404

    def test_outcome_rejects_cancelled_value(self, client, doctor_header, portal_doctor, sample_patient, db):
        slot = _today_slot(db, portal_doctor.id, time(9, 0))
        appt = _appointment(db, sample_patient.id, portal_doctor.id, slot.id)
        db.commit()
        resp = client.put(
            f"/v1/doctor/appointments/{appt.id}/outcome",
            headers=doctor_header,
            json={"status": "CANCELLED"},
        )
        assert resp.status_code == 422


class TestSlotSelfService:
    def test_create_single_slot(self, client, doctor_header):
        resp = client.post("/v1/doctor/slots", headers=doctor_header, json={
            "date": str(date.today() + timedelta(days=1)),
            "start_time": "09:00:00",
        })
        assert resp.status_code == 201
        assert resp.json()["is_available"] is True

    def test_duplicate_slot_rejected(self, client, doctor_header):
        body = {"date": str(date.today() + timedelta(days=1)), "start_time": "09:00:00"}
        assert client.post("/v1/doctor/slots", headers=doctor_header, json=body).status_code == 201
        assert client.post("/v1/doctor/slots", headers=doctor_header, json=body).status_code == 409

    def test_bulk_create_weekdays(self, client, doctor_header, db):
        # Monday-to-Sunday window, weekdays only, 9:00-11:00 with 30-min slots = 4/day
        start = date.today() + timedelta(days=1)
        end = start + timedelta(days=6)  # 7-day window always contains 5 weekdays
        resp = client.post("/v1/doctor/slots/bulk", headers=doctor_header, json={
            "start_date": str(start),
            "end_date": str(end),
            "start_time": "09:00:00",
            "end_time": "11:00:00",
            "duration_minutes": 30,
        })
        assert resp.status_code == 201
        body = resp.json()
        assert body["created"] == 5 * 4
        assert body["skipped_existing"] == 0

        # Re-running is idempotent
        resp2 = client.post("/v1/doctor/slots/bulk", headers=doctor_header, json={
            "start_date": str(start),
            "end_date": str(end),
            "start_time": "09:00:00",
            "end_time": "11:00:00",
            "duration_minutes": 30,
        })
        assert resp2.json()["created"] == 0
        assert resp2.json()["skipped_existing"] == 5 * 4

    def test_bulk_create_range_too_long_rejected(self, client, doctor_header):
        resp = client.post("/v1/doctor/slots/bulk", headers=doctor_header, json={
            "start_date": str(date.today()),
            "end_date": str(date.today() + timedelta(days=120)),
            "start_time": "09:00:00",
            "end_time": "11:00:00",
        })
        assert resp.status_code == 422

    def test_delete_booked_slot_blocked(self, client, doctor_header, portal_doctor, sample_patient, db):
        slot = _today_slot(db, portal_doctor.id, time(9, 0))
        _appointment(db, sample_patient.id, portal_doctor.id, slot.id)
        db.commit()
        resp = client.delete(f"/v1/doctor/slots/{slot.id}", headers=doctor_header)
        assert resp.status_code == 409

    def test_cannot_touch_another_doctors_slot(self, client, doctor_header, sample_slot):
        assert client.delete(f"/v1/doctor/slots/{sample_slot.id}", headers=doctor_header).status_code == 404
        assert client.put(f"/v1/doctor/slots/{sample_slot.id}/close", headers=doctor_header).status_code == 404


class TestMorningBriefing:
    def test_briefing_empty_day(self, client, doctor_header):
        resp = client.get("/v1/doctor/briefing", headers=doctor_header)
        assert resp.status_code == 200
        body = resp.json()
        assert body["total_appointments"] == 0
        assert "clear" in body["summary"].lower()

    def test_briefing_counts_case_mix(self, client, doctor_header, portal_doctor, sample_patient, db):
        for i, sev in enumerate([5, 3, 1]):
            slot = _today_slot(db, portal_doctor.id, time(9 + i, 0))
            _appointment(db, sample_patient.id, portal_doctor.id, slot.id, severity=sev)
        db.commit()
        resp = client.get("/v1/doctor/briefing", headers=doctor_header)
        body = resp.json()
        assert body["total_appointments"] == 3
        assert body["critical_count"] == 1
        assert body["moderate_count"] == 1
        assert body["routine_count"] == 1
        assert body["first_appointment_time"] == "09:00:00"
        assert body["summary"]  # non-empty (LLM fallback path in tests)


class TestDoctorRescheduleVisibility:
    def test_pending_swaps_visible(self, client, doctor_header, portal_doctor, sample_patient, db):
        crit_slot = _today_slot(db, portal_doctor.id, time(15, 0))
        crit_appt = _appointment(db, sample_patient.id, portal_doctor.id, crit_slot.id, severity=5)
        target_slot = _today_slot(db, portal_doctor.id, time(9, 0))
        target_appt = _appointment(db, sample_patient.id, portal_doctor.id, target_slot.id, severity=1)
        req = RescheduleRequest(
            triggering_appointment_id=crit_appt.id,
            target_appointment_id=target_appt.id,
            proposed_slot_id=crit_slot.id,
            status=RescheduleRequest.PENDING,
        )
        db.add(req)
        db.commit()

        resp = client.get("/v1/doctor/reschedules", headers=doctor_header)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["severity_score"] == 5
        assert data[0]["target_slot_time"] == "09:00:00"
