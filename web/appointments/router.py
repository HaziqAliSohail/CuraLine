from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database.db import get_db_session
from models.appointment import Appointment
from models.patient import Patient
from web.appointments.schemas import AppointmentOutSchema, AppointmentStatusUpdateSchema
from web.auth.security import get_current_patient

appointments_router = APIRouter()


def _build_out(appt: Appointment) -> dict:
    return {
        "id": appt.id,
        "patient_id": appt.patient_id,
        "doctor_id": appt.doctor_id,
        "slot_id": appt.slot_id,
        "status": appt.status,
        "reason": appt.reason,
        "severity_score": appt.severity_score,
        "reschedule_requested": appt.reschedule_requested,
        "slot_date": appt.slot.date if appt.slot else None,
        "slot_time": appt.slot.start_time if appt.slot else None,
        "doctor_name": appt.doctor.name if appt.doctor else None,
    }


@appointments_router.get("/", response_model=list[AppointmentOutSchema])
def list_appointments(
    current_patient: Patient = Depends(get_current_patient),
    db: Session = Depends(get_db_session),
):
    appts = (
        db.query(Appointment)
        .filter(Appointment.patient_id == current_patient.id)
        .order_by(Appointment.id.desc())
        .all()
    )
    return [_build_out(a) for a in appts]


@appointments_router.get("/{appointment_id}", response_model=AppointmentOutSchema)
def get_appointment(
    appointment_id: int,
    current_patient: Patient = Depends(get_current_patient),
    db: Session = Depends(get_db_session),
):
    appt = db.query(Appointment).filter(
        Appointment.id == appointment_id,
        Appointment.patient_id == current_patient.id,
    ).first()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found.")
    return _build_out(appt)


@appointments_router.put("/{appointment_id}/status", response_model=AppointmentOutSchema)
def update_appointment_status(
    appointment_id: int,
    body: AppointmentStatusUpdateSchema,
    current_patient: Patient = Depends(get_current_patient),
    db: Session = Depends(get_db_session),
):
    appt = db.query(Appointment).filter(
        Appointment.id == appointment_id,
        Appointment.patient_id == current_patient.id,
    ).first()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found.")
    appt.status = body.status
    db.flush()
    return _build_out(appt)


@appointments_router.delete("/{appointment_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_appointment(
    appointment_id: int,
    current_patient: Patient = Depends(get_current_patient),
    db: Session = Depends(get_db_session),
):
    appt = db.query(Appointment).filter(
        Appointment.id == appointment_id,
        Appointment.patient_id == current_patient.id,
    ).first()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found.")
    if appt.status != Appointment.SCHEDULED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only SCHEDULED appointments can be cancelled.",
        )
    appt.status = Appointment.CANCELLED
    # Free up the slot
    if appt.slot:
        appt.slot.is_available = True
