"""Unit tests for SQLAlchemy models."""
from datetime import date, time, timedelta

from models.patient import Patient
from models.doctor import Doctor
from models.doctor_slot import DoctorSlot
from models.appointment import Appointment
from models.reschedule_request import RescheduleRequest
from web.auth.security import hash_password


class TestPatientModel:
    def test_create_patient(self, db):
        p = Patient(
            name="John Doe",
            gender="MALE",
            phone="5551234",
            email="john@test.com",
            password_hash=hash_password("pass1234"),
        )
        db.add(p)
        db.commit()
        assert p.id is not None
        assert p.name == "John Doe"
        assert p.gender == "MALE"

    def test_patient_medical_history_nullable(self, db):
        p = Patient(
            name="Jane",
            gender="FEMALE",
            email="jane@test.com",
            password_hash=hash_password("pass1234"),
        )
        db.add(p)
        db.commit()
        assert p.medical_history is None

    def test_patient_timestamps_set(self, db):
        p = Patient(
            name="Time Test",
            gender="OTHER",
            email="time@test.com",
            password_hash=hash_password("pass1234"),
        )
        db.add(p)
        db.commit()
        db.refresh(p)
        assert p.created_at is not None
        assert p.updated_at is not None


class TestDoctorModel:
    def test_create_doctor(self, db):
        d = Doctor(
            name="Dr. House",
            gender="MALE",
            specialization="Diagnostics",
            qualification="MD",
            consultation_fee=500,
            reporting_time=time(8, 0),
            leaving_time=time(16, 0),
        )
        db.add(d)
        db.commit()
        assert d.id is not None
        assert d.availability_status == "AVAILABLE"  # default
        assert d.rating == 5  # default

    def test_doctor_availability_statuses(self, db):
        for status in ["AVAILABLE", "LEAVE", "OFFLINE"]:
            d = Doctor(
                name=f"Dr. {status}",
                gender="MALE",
                specialization="General",
                qualification="MD",
                consultation_fee=100,
                reporting_time=time(9, 0),
                leaving_time=time(17, 0),
                availability_status=status,
            )
            db.add(d)
        db.commit()
        assert db.query(Doctor).count() == 3


class TestDoctorSlotModel:
    def test_create_slot(self, db, sample_doctor):
        s = DoctorSlot(
            doctor_id=sample_doctor.id,
            date=date.today(),
            start_time=time(10, 0),
            duration_minutes=30,
            closes_before_minutes=15,
        )
        db.add(s)
        db.commit()
        assert s.id is not None
        assert s.is_available is True  # default

    def test_slot_doctor_relationship(self, db, sample_doctor):
        s = DoctorSlot(
            doctor_id=sample_doctor.id,
            date=date.today(),
            start_time=time(11, 0),
        )
        db.add(s)
        db.commit()
        db.refresh(s)
        assert s.doctor.name == sample_doctor.name


class TestAppointmentModel:
    def test_create_appointment(self, db, sample_patient, sample_doctor, sample_slot):
        a = Appointment(
            patient_id=sample_patient.id,
            doctor_id=sample_doctor.id,
            slot_id=sample_slot.id,
            reason="Headache",
            severity_score=2,
        )
        db.add(a)
        db.commit()
        assert a.id is not None
        assert a.status == "SCHEDULED"  # default
        assert a.reschedule_requested is False  # default

    def test_appointment_relationships(self, sample_appointment, db):
        db.refresh(sample_appointment)
        assert sample_appointment.patient.name == "Test Patient"
        assert sample_appointment.doctor.name == "Dr. Smith"
        assert sample_appointment.slot is not None

    def test_appointment_statuses(self):
        assert Appointment.STATUSES == ["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"]


class TestRescheduleRequestModel:
    def test_create_reschedule_request(self, db, sample_appointment, sample_slot):
        # Create a second patient and appointment to be the target
        second_patient = Patient(
            name="Second",
            gender="FEMALE",
            email="second@test.com",
            password_hash=hash_password("pass1234"),
        )
        db.add(second_patient)
        db.flush()

        second_slot = DoctorSlot(
            doctor_id=sample_appointment.doctor_id,
            date=date.today() + timedelta(days=2),
            start_time=time(14, 0),
        )
        db.add(second_slot)
        db.flush()

        target_appt = Appointment(
            patient_id=second_patient.id,
            doctor_id=sample_appointment.doctor_id,
            slot_id=second_slot.id,
            reason="Routine",
            severity_score=1,
        )
        db.add(target_appt)
        db.flush()

        rr = RescheduleRequest(
            triggering_appointment_id=sample_appointment.id,
            target_appointment_id=target_appt.id,
            proposed_slot_id=sample_slot.id,
        )
        db.add(rr)
        db.commit()

        assert rr.id is not None
        assert rr.status == "PENDING"  # default
