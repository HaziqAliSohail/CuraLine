"""Regression tests for the 'book me with Dr. X' bug: the AI pipeline used to
ignore an explicitly requested doctor and book purely by specialization.
Also covers suppression of urgency banners on routine (severity-1) visits."""
from datetime import date, time, timedelta
from unittest.mock import patch

import pytest

from models.doctor import Doctor
from models.doctor_slot import DoctorSlot


def _intake(collected):
    return {
        "stage": "intake",
        "collected": collected,
        "missing": [],
        "reply": "Booking now.",
        "ready_to_analyze": True,
    }


SEVERITY_ROUTINE = {
    "severity_score": 1,
    "recommended_specialization": "General Medicine",
    "analysis_summary": "Routine preventive care.",
    "is_emergency": False,
}


@pytest.fixture()
def jenkins(db):
    d = Doctor(
        name="Dr. Sarah Jenkins", gender="FEMALE", email="sj@hospital.com",
        specialization="Cardiology", qualification="MD", availability_status="AVAILABLE",
        consultation_fee=150.00, reporting_time=time(9, 0), leaving_time=time(17, 0),
    )
    db.add(d)
    db.flush()
    return d


@pytest.fixture()
def reyes(db):
    d = Doctor(
        name="Dr. Carlos Reyes", gender="MALE", email="cr@hospital.com",
        specialization="General Medicine", qualification="MD", availability_status="AVAILABLE",
        consultation_fee=100.00, reporting_time=time(9, 0), leaving_time=time(17, 0),
    )
    db.add(d)
    db.flush()
    return d


def _slot(db, doctor_id, start=time(10, 0)):
    s = DoctorSlot(
        doctor_id=doctor_id, date=date.today() + timedelta(days=1),
        start_time=start, duration_minutes=30, is_available=True,
    )
    db.add(s)
    db.flush()
    return s


def _run_task(db, patient_id, collected, severity=SEVERITY_ROUTINE):
    from tasks.chat_tasks import chat_execution_task

    with patch("database.db.connection", return_value=db):
        with patch("clients.llmclient.LLMClient.query_structured") as mock_query:
            mock_query.side_effect = [_intake(collected), severity]
            original_close = db.close
            db.close = lambda: None
            try:
                return chat_execution_task(
                    patient_id=patient_id,
                    conversation_history=[{"role": "user", "content": "book an appointment with sarah jenkins"}],
                    collected_fields={},
                )
            finally:
                db.close = original_close


class TestPreferredDoctor:
    def test_named_doctor_wins_over_specialization(self, db, sample_patient, jenkins, reyes):
        """'book me with sarah jenkins' must book Jenkins even when the AI
        recommends General Medicine."""
        _slot(db, jenkins.id)
        _slot(db, reyes.id)
        db.commit()

        result = _run_task(db, sample_patient.id, {
            "chief_complaint": "annual check up",
            "symptoms": [],
            "symptom_duration": None,
            "pain_level": None,
            "preferred_doctor": "sarah jenkins",
        })

        assert result["is_booked"] is True
        assert "Sarah Jenkins" in result["reply"]
        assert "Cardiology" in result["reply"]

        from models.appointment import Appointment
        appt = db.query(Appointment).filter(Appointment.id == result["appointment_id"]).first()
        assert appt.doctor_id == jenkins.id

    def test_dr_prefix_handled(self, db, sample_patient, jenkins, reyes):
        _slot(db, jenkins.id)
        _slot(db, reyes.id)
        db.commit()
        result = _run_task(db, sample_patient.id, {
            "chief_complaint": "annual check up", "symptoms": [],
            "symptom_duration": None, "pain_level": None,
            "preferred_doctor": "Dr. Jenkins",
        })
        assert result["is_booked"] is True
        assert "Sarah Jenkins" in result["reply"]

    def test_falls_back_when_preferred_doctor_has_no_slots(self, db, sample_patient, jenkins, reyes):
        _slot(db, reyes.id)  # Jenkins has no slots
        db.commit()
        result = _run_task(db, sample_patient.id, {
            "chief_complaint": "annual check up", "symptoms": [],
            "symptom_duration": None, "pain_level": None,
            "preferred_doctor": "sarah jenkins",
        })
        assert result["is_booked"] is True
        assert "no open slots" in result["reply"]
        assert "Carlos Reyes" in result["reply"]

    def test_unknown_doctor_name_mentioned_in_reply(self, db, sample_patient, reyes):
        _slot(db, reyes.id)
        db.commit()
        result = _run_task(db, sample_patient.id, {
            "chief_complaint": "annual check up", "symptoms": [],
            "symptom_duration": None, "pain_level": None,
            "preferred_doctor": "Dr. Nobody",
        })
        assert result["is_booked"] is True
        assert "couldn't find" in result["reply"]
        assert "Carlos Reyes" in result["reply"]

    def test_no_preference_books_by_specialization(self, db, sample_patient, jenkins, reyes):
        _slot(db, jenkins.id)
        _slot(db, reyes.id)
        db.commit()
        result = _run_task(db, sample_patient.id, {
            "chief_complaint": "annual check up", "symptoms": [],
            "symptom_duration": None, "pain_level": None,
        })
        assert result["is_booked"] is True
        assert "Carlos Reyes" in result["reply"]  # General Medicine recommendation


class TestRoutineGuidanceSuppression:
    def test_no_urgency_banner_on_severity_one(self, db, sample_patient, reyes):
        """A routine checkup must not show a Telehealth/urgency banner even if
        keyword matching finds something in the symptom text."""
        _slot(db, reyes.id)
        db.commit()
        result = _run_task(db, sample_patient.id, {
            "chief_complaint": "annual check up",
            "symptoms": ["mild back pain"],  # would keyword-match TELEHEALTH
            "symptom_duration": "n/a",
            "pain_level": 1,
        })
        assert result["is_booked"] is True
        assert result["urgent_guidance"] is None
        assert result["guidance_type"] is None

    def test_banner_kept_for_higher_severity(self, db, sample_patient, jenkins, reyes):
        _slot(db, reyes.id)
        db.commit()
        result = _run_task(
            db, sample_patient.id,
            {
                "chief_complaint": "persistent migraine",
                "symptoms": ["migraine"],
                "symptom_duration": "2 days",
                "pain_level": 6,
            },
            severity={
                "severity_score": 3,
                "recommended_specialization": "General Medicine",
                "analysis_summary": "Needs evaluation.",
                "is_emergency": False,
            },
        )
        assert result["is_booked"] is True
        assert result["guidance_type"] is not None
