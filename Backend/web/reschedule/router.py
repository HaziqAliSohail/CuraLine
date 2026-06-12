from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database.db import get_db_session
from models.appointment import Appointment
from models.doctor_slot import DoctorSlot
from models.patient import Patient
from models.reschedule_request import RescheduleRequest
from web.auth.security import get_current_patient
from web.reschedule.schemas import RescheduleRequestOutSchema

reschedule_router = APIRouter()


def _build_out(req: RescheduleRequest) -> dict:
    target_slot = req.target_appointment.slot if req.target_appointment else None
    return {
        "id": req.id,
        "triggering_appointment_id": req.triggering_appointment_id,
        "target_appointment_id": req.target_appointment_id,
        "proposed_slot_id": req.proposed_slot_id,
        "status": req.status,
        "proposed_slot_date": req.proposed_slot.date if req.proposed_slot else None,
        "proposed_slot_time": req.proposed_slot.start_time if req.proposed_slot else None,
        "current_slot_date": target_slot.date if target_slot else None,
        "current_slot_time": target_slot.start_time if target_slot else None,
    }


@reschedule_router.get("/", response_model=list[RescheduleRequestOutSchema])
def list_reschedule_requests(
    current_patient: Patient = Depends(get_current_patient),
    db: Session = Depends(get_db_session),
):
    reqs = (
        db.query(RescheduleRequest)
        .join(Appointment, RescheduleRequest.target_appointment_id == Appointment.id)
        .filter(
            Appointment.patient_id == current_patient.id,
            RescheduleRequest.status == RescheduleRequest.PENDING,
        )
        .all()
    )
    return [_build_out(r) for r in reqs]


@reschedule_router.post("/{request_id}/accept", response_model=RescheduleRequestOutSchema)
def accept_reschedule(
    request_id: int,
    current_patient: Patient = Depends(get_current_patient),
    db: Session = Depends(get_db_session),
):
    # Lock the request row so two concurrent accepts cannot both pass the
    # PENDING check (no-op on SQLite, row lock on PostgreSQL).
    req = (
        db.query(RescheduleRequest)
        .filter(RescheduleRequest.id == request_id)
        .with_for_update()
        .first()
    )
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found.")

    target_appt = db.query(Appointment).filter(Appointment.id == req.target_appointment_id).first()
    if not target_appt or target_appt.patient_id != current_patient.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your reschedule request.")

    if req.status != RescheduleRequest.PENDING:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Request is no longer pending.")

    triggering_appt = db.query(Appointment).filter(
        Appointment.id == req.triggering_appointment_id
    ).first()
    if triggering_appt and triggering_appt.status != Appointment.SCHEDULED:
        # The critical patient cancelled in the meantime — nothing to swap into.
        req.status = RescheduleRequest.DECLINED
        target_appt.reschedule_requested = False
        db.flush()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The requesting appointment is no longer active. No swap is needed.",
        )

    # Before swap: target_appt is on original_slot, triggering_appt is on proposed_slot
    # After swap:  target_appt moves to proposed_slot, triggering_appt moves to original_slot
    original_slot_id = target_appt.slot_id
    proposed_slot_id = req.proposed_slot_id

    proposed_slot = db.query(DoctorSlot).filter(DoctorSlot.id == proposed_slot_id).first()
    original_slot = db.query(DoctorSlot).filter(DoctorSlot.id == original_slot_id).first()

    target_appt.slot_id = proposed_slot_id
    if proposed_slot:
        target_appt.doctor_id = proposed_slot.doctor_id
    target_appt.reschedule_requested = False

    if triggering_appt:
        triggering_appt.slot_id = original_slot_id
        if original_slot:
            triggering_appt.doctor_id = original_slot.doctor_id

    req.status = RescheduleRequest.ACCEPTED

    # One swap fulfils the critical patient's need: invalidate every other
    # PENDING request spawned by the same triggering appointment so a second
    # patient cannot also "accept" and corrupt the schedule.
    sibling_requests = (
        db.query(RescheduleRequest)
        .filter(
            RescheduleRequest.triggering_appointment_id == req.triggering_appointment_id,
            RescheduleRequest.id != req.id,
            RescheduleRequest.status == RescheduleRequest.PENDING,
        )
        .all()
    )
    for sibling in sibling_requests:
        sibling.status = RescheduleRequest.DECLINED
        sibling_target = db.query(Appointment).filter(
            Appointment.id == sibling.target_appointment_id
        ).first()
        if sibling_target:
            sibling_target.reschedule_requested = False

    db.flush()

    return _build_out(req)


@reschedule_router.post("/{request_id}/decline", response_model=RescheduleRequestOutSchema)
def decline_reschedule(
    request_id: int,
    current_patient: Patient = Depends(get_current_patient),
    db: Session = Depends(get_db_session),
):
    req = db.query(RescheduleRequest).filter(RescheduleRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found.")

    target_appt = db.query(Appointment).filter(Appointment.id == req.target_appointment_id).first()
    if not target_appt or target_appt.patient_id != current_patient.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your reschedule request.")

    if req.status != RescheduleRequest.PENDING:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Request is no longer pending.")

    req.status = RescheduleRequest.DECLINED
    target_appt.reschedule_requested = False
    db.flush()

    return _build_out(req)
