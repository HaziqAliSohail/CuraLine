"""Integration tests to verify the two-way slot swap logic for reschedule requests."""
from datetime import date, time, timedelta
from models.appointment import Appointment
from models.doctor_slot import DoctorSlot
from models.patient import Patient
from models.reschedule_request import RescheduleRequest
from web.auth.security import hash_password, create_access_token


def test_reschedule_two_way_swap(client, sample_appointment, sample_doctor, db):
    """
    Verify that accepting a reschedule request correctly swaps BOTH appointments:
    1. Target appointment moves to the proposed slot (which the critical patient occupied).
    2. Triggering appointment (critical patient) moves to the target's original slot.
    """
    # Create the target patient (low priority)
    target_patient = Patient(
        name="Target Patient",
        gender="FEMALE",
        email="target@test.com",
        password_hash=hash_password("securepass1"),
    )
    db.add(target_patient)
    db.flush()

    # The triggering appointment slot (e.g. tomorrow at 10 AM, booked by critical patient)
    triggering_slot = sample_appointment.slot

    # The target patient's current slot (e.g. tomorrow at 11 AM)
    target_slot = DoctorSlot(
        doctor_id=sample_doctor.id,
        date=date.today() + timedelta(days=1),
        start_time=time(11, 0),
        duration_minutes=30,
        is_available=False,
    )
    db.add(target_slot)
    db.flush()

    # Target appointment starts on the target_slot
    target_appt = Appointment(
        patient_id=target_patient.id,
        doctor_id=sample_doctor.id,
        slot_id=target_slot.id,
        status=Appointment.SCHEDULED,
        reason="Routine cleaning",
        severity_score=1,
        reschedule_requested=True,
    )
    db.add(target_appt)
    db.flush()

    # The reschedule request proposes that target_appt moves to triggering_slot
    rr = RescheduleRequest(
        triggering_appointment_id=sample_appointment.id,
        target_appointment_id=target_appt.id,
        proposed_slot_id=triggering_slot.id,
        status=RescheduleRequest.PENDING,
    )
    db.add(rr)
    db.commit()

    # Act: target patient accepts the reschedule request
    target_token = create_access_token(target_patient.id)
    resp = client.post(
        f"/v1/reschedule/{rr.id}/accept",
        headers={"Authorization": f"Bearer {target_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "ACCEPTED"

    # Refresh DB objects
    db.refresh(sample_appointment)
    db.refresh(target_appt)
    db.refresh(rr)

    # Assert 1: Target appointment should now be on triggering_slot
    assert target_appt.slot_id == triggering_slot.id
    assert target_appt.reschedule_requested is False

    # Assert 2: Triggering appointment should now be on target_slot
    assert sample_appointment.slot_id == target_slot.id

    # Assert 3: Reschedule request status is ACCEPTED
    assert rr.status == RescheduleRequest.ACCEPTED
