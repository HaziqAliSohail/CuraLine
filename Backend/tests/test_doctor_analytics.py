"""Tests for the doctor practice-analytics endpoint."""
from datetime import date, time, timedelta

import pytest

from models.appointment import Appointment
from models.doctor import Doctor
from models.doctor_slot import DoctorSlot
from web.auth.security import ROLE_DOCTOR, create_access_token, hash_password


@pytest.fixture()
def analytics_doctor(db):
    d = Doctor(
        name="Dr. Stats",
        gender="MALE",
        email="stats@hospital.com",
        specialization="Cardiology",
        qualification="MD",
        availability_status="AVAILABLE",
        consultation_fee=100.00,
        reporting_time=time(9, 0),
        leaving_time=time(17, 0),
        password_hash=hash_password("statspass1"),
    )
    db.add(d)
    db.commit()
    db.refresh(d)
    return d


@pytest.fixture()
def stats_header(analytics_doctor):
    token = create_access_token(analytics_doctor.id, role=ROLE_DOCTOR)
    return {"Authorization": f"Bearer {token}"}


def _visit(db, doctor_id, patient_id, day, start, status, severity):
    slot = DoctorSlot(
        doctor_id=doctor_id, date=day, start_time=start,
        duration_minutes=30, is_available=False,
    )
    db.add(slot)
    db.flush()
    appt = Appointment(
        patient_id=patient_id, doctor_id=doctor_id, slot_id=slot.id,
        status=status, severity_score=severity,
    )
    db.add(appt)
    db.flush()
    return appt


class TestDoctorAnalytics:
    def test_empty_analytics(self, client, stats_header):
        resp = client.get("/v1/doctor/analytics", headers=stats_header)
        assert resp.status_code == 200
        body = resp.json()
        assert body["total_appointments"] == 0
        assert body["no_show_rate"] is None
        assert body["avg_severity"] is None
        assert body["busiest_weekday"] is None

    def test_no_show_rate_and_case_mix(self, client, stats_header, analytics_doctor, sample_patient, db):
        d = analytics_doctor.id
        p = sample_patient.id
        yesterday = date.today() - timedelta(days=1)
        # 3 completed, 1 no-show → no-show rate 25%
        _visit(db, d, p, yesterday, time(9, 0), Appointment.COMPLETED, 5)
        _visit(db, d, p, yesterday, time(10, 0), Appointment.COMPLETED, 3)
        _visit(db, d, p, yesterday, time(11, 0), Appointment.COMPLETED, 1)
        _visit(db, d, p, yesterday, time(12, 0), Appointment.NO_SHOW, 1)
        # Cancelled visits are excluded from case mix but counted in totals
        _visit(db, d, p, yesterday, time(13, 0), Appointment.CANCELLED, 4)
        db.commit()

        resp = client.get("/v1/doctor/analytics", headers=stats_header)
        body = resp.json()
        assert body["total_appointments"] == 5
        assert body["completed"] == 3
        assert body["no_show"] == 1
        assert body["cancelled"] == 1
        assert body["no_show_rate"] == 25.0
        assert body["avg_severity"] == 2.5  # (5+3+1+1)/4 — cancelled excluded
        assert body["severity_counts"]["5"] == 1 or body["severity_counts"][5] == 1
        assert body["busiest_weekday"] == yesterday.strftime("%A")

    def test_window_excludes_old_appointments(self, client, stats_header, analytics_doctor, sample_patient, db):
        old_day = date.today() - timedelta(days=60)
        _visit(db, analytics_doctor.id, sample_patient.id, old_day, time(9, 0), Appointment.COMPLETED, 4)
        db.commit()

        in_window = client.get("/v1/doctor/analytics?days=30", headers=stats_header).json()
        assert in_window["total_appointments"] == 0

        wide = client.get("/v1/doctor/analytics?days=90", headers=stats_header).json()
        assert wide["total_appointments"] == 1

    def test_other_doctors_data_excluded(self, client, stats_header, sample_appointment):
        resp = client.get("/v1/doctor/analytics", headers=stats_header)
        assert resp.json()["total_appointments"] == 0

    def test_requires_doctor_role(self, client, auth_header):
        assert client.get("/v1/doctor/analytics", headers=auth_header).status_code == 401
