from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database.db import get_db_session
from models.doctor import Doctor
from web.doctors.schemas import DoctorInSchema, DoctorOutSchema

doctors_router = APIRouter()


@doctors_router.get("/", response_model=list[DoctorOutSchema])
def list_doctors(
    specialization: str | None = None,
    availability_status: str | None = None,
    db: Session = Depends(get_db_session),
):
    query = db.query(Doctor)
    if specialization:
        query = query.filter(Doctor.specialization.ilike(f"%{specialization}%"))
    if availability_status:
        query = query.filter(Doctor.availability_status == availability_status)
    return query.all()


@doctors_router.post("/", response_model=DoctorOutSchema, status_code=status.HTTP_201_CREATED)
def create_doctor(body: DoctorInSchema, db: Session = Depends(get_db_session)):
    doctor = Doctor(**body.model_dump())
    db.add(doctor)
    db.flush()
    db.refresh(doctor)
    return doctor


@doctors_router.get("/{doctor_id}", response_model=DoctorOutSchema)
def get_doctor(doctor_id: int, db: Session = Depends(get_db_session)):
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found.")
    return doctor


@doctors_router.put("/{doctor_id}", response_model=DoctorOutSchema)
def update_doctor(doctor_id: int, body: DoctorInSchema, db: Session = Depends(get_db_session)):
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found.")
    for field, value in body.model_dump().items():
        setattr(doctor, field, value)
    db.flush()
    db.refresh(doctor)
    return doctor


@doctors_router.delete("/{doctor_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_doctor(doctor_id: int, db: Session = Depends(get_db_session)):
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found.")
    db.delete(doctor)
