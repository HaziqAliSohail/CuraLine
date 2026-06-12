from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database.db import get_db_session
from models.appointment import Appointment
from models.patient import Patient
from models.doctor_slot import DoctorSlot
from web.appointments.schemas import (
    AppointmentOutSchema,
    AppointmentStatusUpdateSchema,
    AppointmentCreateSchema,
)
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
        "doctor_specialization": appt.doctor.specialization if appt.doctor else None,
    }


@appointments_router.get("/", response_model=list[AppointmentOutSchema])
def list_appointments(
    current_patient: Patient = Depends(get_current_patient),
    db: Session = Depends(get_db_session),
):
    appts = (
        db.query(Appointment)
        .join(DoctorSlot, Appointment.slot_id == DoctorSlot.id)
        .filter(Appointment.patient_id == current_patient.id)
        .order_by(DoctorSlot.date, DoctorSlot.start_time)
        .all()
    )
    return [_build_out(a) for a in appts]


@appointments_router.get("/upcoming", response_model=list[AppointmentOutSchema])
def list_upcoming_appointments(
    current_patient: Patient = Depends(get_current_patient),
    db: Session = Depends(get_db_session),
):
    """Return only SCHEDULED appointments with a future or today slot date, soonest first."""
    today = date.today()
    appts = (
        db.query(Appointment)
        .join(DoctorSlot, Appointment.slot_id == DoctorSlot.id)
        .filter(
            Appointment.patient_id == current_patient.id,
            Appointment.status == Appointment.SCHEDULED,
            DoctorSlot.date >= today,
        )
        .order_by(DoctorSlot.date, DoctorSlot.start_time)
        .all()
    )
    return [_build_out(a) for a in appts]


@appointments_router.post("/", response_model=AppointmentOutSchema, status_code=status.HTTP_201_CREATED)
def create_appointment(
    body: AppointmentCreateSchema,
    current_patient: Patient = Depends(get_current_patient),
    db: Session = Depends(get_db_session),
):
    # Use SELECT FOR UPDATE to prevent double-booking race conditions
    slot = db.query(DoctorSlot).filter(DoctorSlot.id == body.slot_id).with_for_update().first()
    if not slot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Slot not found.",
        )
    if not slot.is_available:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This slot is already booked or unavailable.",
        )

    # Mark slot as unavailable atomically
    slot.is_available = False

    appt = Appointment(
        patient_id=current_patient.id,
        doctor_id=slot.doctor_id,
        slot_id=slot.id,
        status=Appointment.SCHEDULED,
        reason=body.reason,
        severity_score=1,
        reschedule_requested=False,
    )
    db.add(appt)
    db.flush()
    db.refresh(appt)

    if current_patient.email:
        from clients import emailer
        slot_info = f"{slot.date} at {slot.start_time.strftime('%I:%M %p')}"
        doctor_name = appt.doctor.name if appt.doctor else "your doctor"
        emailer.appointment_confirmed(current_patient.email, current_patient.name, doctor_name, slot_info)

    return _build_out(appt)


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
    if appt.status != Appointment.SCHEDULED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only SCHEDULED appointments can change status.",
        )
    # Visit outcomes (COMPLETED / NO_SHOW) are recorded by the doctor via the
    # doctor portal — patients may only cancel.
    if body.status != Appointment.CANCELLED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Patients can only cancel appointments. Visit outcomes are recorded by your doctor.",
        )
    appt.status = body.status
    # Cancelling via status update must free the slot, same as DELETE
    if body.status == Appointment.CANCELLED and appt.slot:
        appt.slot.is_available = True
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
    db.flush()

    if current_patient.email and appt.slot:
        from clients import emailer
        slot_info = f"{appt.slot.date} at {appt.slot.start_time.strftime('%I:%M %p')}"
        doctor_name = appt.doctor.name if appt.doctor else "your doctor"
        emailer.appointment_cancelled(current_patient.email, current_patient.name, doctor_name, slot_info)
