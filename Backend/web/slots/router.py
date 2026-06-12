from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database.db import get_db_session
from models.doctor import Doctor
from models.doctor_slot import DoctorSlot
from models.patient import Patient
from web.auth.permissions import require_admin
from web.slots.schemas import SlotInSchema, SlotOutSchema

slots_router = APIRouter()


@slots_router.get("/", response_model=list[SlotOutSchema])
def list_slots(
    doctor_id: int | None = None,
    slot_date: date | None = None,
    available_only: bool = False,
    db: Session = Depends(get_db_session),
):
    query = db.query(DoctorSlot)
    if doctor_id:
        query = query.filter(DoctorSlot.doctor_id == doctor_id)
    if slot_date:
        query = query.filter(DoctorSlot.date == slot_date)
    if available_only:
        query = query.filter(DoctorSlot.is_available == True)  # noqa: E712
    return query.order_by(DoctorSlot.date, DoctorSlot.start_time).all()


@slots_router.post("/", response_model=SlotOutSchema, status_code=status.HTTP_201_CREATED)
def create_slot(
    body: SlotInSchema,
    _admin: Patient = Depends(require_admin),
    db: Session = Depends(get_db_session),
):
    doctor = db.query(Doctor).filter(Doctor.id == body.doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found.")

    slot = DoctorSlot(**body.model_dump())
    db.add(slot)
    db.flush()
    db.refresh(slot)
    return slot


@slots_router.put("/{slot_id}/close", response_model=SlotOutSchema)
def close_slot(
    slot_id: int,
    _admin: Patient = Depends(require_admin),
    db: Session = Depends(get_db_session),
):
    slot = db.query(DoctorSlot).filter(DoctorSlot.id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Slot not found.")
    slot.is_available = False
    db.flush()
    db.refresh(slot)
    return slot


@slots_router.delete("/{slot_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_slot(
    slot_id: int,
    _admin: Patient = Depends(require_admin),
    db: Session = Depends(get_db_session),
):
    slot = db.query(DoctorSlot).filter(DoctorSlot.id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Slot not found.")
    db.delete(slot)
