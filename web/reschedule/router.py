from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database.db import get_db_session
from models.appointment import Appointment
from models.patient import Patient
from models.reschedule_request import RescheduleRequest
from web.auth.security import get_current_patient
from web.reschedule.schemas import RescheduleRequestOutSchema

reschedule_router = APIRouter()


def _build_out(req: RescheduleRequest) -> dict:
    return {
        "id": req.id,
        "triggering_appointment_id": req.triggering_appointment_id,
        "target_appointment_id": req.target_appointment_id,
        "proposed_slot_id": req.proposed_slot_id,
        "status": req.status,
        "proposed_slot_date": req.proposed_slot.date if req.proposed_slot else None,
        "proposed_slot_time": req.proposed_slot.start_time if req.proposed_slot else None,
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
    req = db.query(RescheduleRequest).filter(RescheduleRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found.")

    target_appt = db.query(Appointment).filter(Appointment.id == req.target_appointment_id).first()
    if not target_appt or target_appt.patient_id != current_patient.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your reschedule request.")

    if req.status != RescheduleRequest.PENDING:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Request is no longer pending.")

    # Swap to proposed slot
    target_appt.slot_id = req.proposed_slot_id
    target_appt.reschedule_requested = False
    req.status = RescheduleRequest.ACCEPTED
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
