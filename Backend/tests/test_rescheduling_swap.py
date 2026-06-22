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


def test_severity_swap_only_targets_consented_patients(client, sample_doctor, db):
    """A critical booking only generates swap requests for patients who opted in
    (allow_severity_swap=True); a patient who didn't is never targeted."""
    from unittest.mock import patch
    from tasks.chat_tasks import chat_execution_task

    def mk_patient(email, consent):
        p = Patient(name=email, gender="MALE", email=email,
                    password_hash=hash_password("securepass1"), allow_severity_swap=consent)
        db.add(p); db.flush()
        return p

    consented = mk_patient("optin@test.com", True)
    declined = mk_patient("optout@test.com", False)
    crit = mk_patient("crit@test.com", False)

    def mk_slot(t, avail):
        s = DoctorSlot(doctor_id=sample_doctor.id, date=date.today() + timedelta(days=1),
                       start_time=t, duration_minutes=30, closes_before_minutes=15, is_available=avail)
        db.add(s); db.flush()
        return s

    s_consent = mk_slot(time(9, 0), False)
    s_declined = mk_slot(time(9, 30), False)
    mk_slot(time(15, 0), True)  # the only open slot — critical books this (latest)

    for p, s in [(consented, s_consent), (declined, s_declined)]:
        db.add(Appointment(patient_id=p.id, doctor_id=sample_doctor.id, slot_id=s.id,
                           status=Appointment.SCHEDULED, reason="routine", severity_score=1))
    db.commit()

    with patch("database.db.connection", return_value=db):
        with patch("clients.llmclient.LLMClient.query_structured") as mq:
            mq.side_effect = [
                {"stage": "intake", "collected": {
                    "chief_complaint": "high blood pressure review needed",
                    "symptoms": ["hypertension"], "symptom_duration": "ongoing", "pain_level": 2},
                 "missing": [], "reply": "ok", "ready_to_analyze": True},
                {"severity_score": 4, "recommended_specialization": "Cardiology",
                 "analysis_summary": "BP review", "is_emergency": False},
            ]
            oc = db.close
            db.close = lambda: None
            try:
                res = chat_execution_task(
                    patient_id=crit.id,
                    conversation_history=[{"role": "user", "content": "bp review"}],
                    collected_fields={},
                )
            finally:
                db.close = oc

    assert res["is_booked"] is True
    db.expire_all()
    targets = {r.target_appointment_id for r in db.query(RescheduleRequest).all()}
    consent_appt = db.query(Appointment).filter(Appointment.patient_id == consented.id).first()
    declined_appt = db.query(Appointment).filter(Appointment.patient_id == declined.id).first()
    assert consent_appt.id in targets       # opted-in patient is asked
    assert declined_appt.id not in targets  # opted-out patient is never targeted
