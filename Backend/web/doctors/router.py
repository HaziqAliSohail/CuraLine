import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database.db import get_db_session
from models.doctor import Doctor
from models.patient import Patient
from web.auth.permissions import require_admin
from web.auth.security import hash_password
from web.doctors.schemas import (
    ApplicationDecisionSchema,
    DoctorApplicationOutSchema,
    DoctorInSchema,
    DoctorOutSchema,
)

doctors_router = APIRouter()


@doctors_router.get("/", response_model=list[DoctorOutSchema])
def list_doctors(
    specialization: str | None = None,
    availability_status: str | None = None,
    insurance: str | None = None,
    db: Session = Depends(get_db_session),
):
    # Patients only ever see verified (approved) doctors
    query = db.query(Doctor).filter(Doctor.application_status == Doctor.APPROVED)
    if specialization:
        query = query.filter(Doctor.specialization.ilike(f"%{specialization}%"))
    if availability_status:
        query = query.filter(Doctor.availability_status == availability_status)
    if insurance:
        # JSON-encoded list stored in a Text column — use LIKE for portability
        query = query.filter(Doctor.accepted_insurance_plans.ilike(f'%"{insurance}"%'))
    return query.all()


# NOTE: declared before /{doctor_id} so "applications" is not parsed as an id
@doctors_router.get("/applications", response_model=list[DoctorApplicationOutSchema])
def list_doctor_applications(
    application_status: str = "PENDING",
    _admin: Patient = Depends(require_admin),
    db: Session = Depends(get_db_session),
):
    """Admin: review doctor onboarding applications (defaults to pending)."""
    if application_status not in Doctor.APPLICATION_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"application_status must be one of {Doctor.APPLICATION_STATUSES}.",
        )
    return (
        db.query(Doctor)
        .filter(Doctor.application_status == application_status)
        .order_by(Doctor.created_at)
        .all()
    )


@doctors_router.put("/{doctor_id}/application", response_model=DoctorApplicationOutSchema)
def decide_doctor_application(
    doctor_id: int,
    body: ApplicationDecisionSchema,
    _admin: Patient = Depends(require_admin),
    db: Session = Depends(get_db_session),
):
    """Admin: approve or reject a pending doctor application after verifying
    the medical license and qualifications."""
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found.")
    if doctor.application_status != Doctor.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This application has already been decided.",
        )
    doctor.application_status = Doctor.APPROVED if body.action == "approve" else Doctor.REJECTED
    db.flush()
    db.refresh(doctor)

    if doctor.email:
        from clients import emailer
        if doctor.application_status == Doctor.APPROVED:
            emailer.application_approved(doctor.email, doctor.name)
        else:
            emailer.application_rejected(doctor.email, doctor.name)
    return doctor


@doctors_router.get("/{doctor_id}", response_model=DoctorOutSchema)
def get_doctor(doctor_id: int, db: Session = Depends(get_db_session)):
    doctor = db.query(Doctor).filter(
        Doctor.id == doctor_id,
        Doctor.application_status == Doctor.APPROVED,
    ).first()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found.")
    return doctor


@doctors_router.post("/", response_model=DoctorOutSchema, status_code=status.HTTP_201_CREATED)
def create_doctor(
    body: DoctorInSchema,
    _admin: Patient = Depends(require_admin),
    db: Session = Depends(get_db_session),
):
    data = body.model_dump()
    password = data.pop("password", None)
    # Serialize the insurance plans list to a JSON string for the Text column
    plans = data.pop("accepted_insurance_plans", [])
    if password and not data.get("email"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="An email is required to provision portal login for a doctor.",
        )
    doctor = Doctor(**data)
    doctor.accepted_insurance_plans = json.dumps(plans) if plans else None
    if password:
        doctor.password_hash = hash_password(password)
    db.add(doctor)
    db.flush()
    db.refresh(doctor)
    return doctor


@doctors_router.put("/{doctor_id}", response_model=DoctorOutSchema)
def update_doctor(
    doctor_id: int,
    body: DoctorInSchema,
    _admin: Patient = Depends(require_admin),
    db: Session = Depends(get_db_session),
):
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found.")
    data = body.model_dump()
    password = data.pop("password", None)
    # Serialize insurance plans to JSON before storing
    plans = data.pop("accepted_insurance_plans", [])
    for field, value in data.items():
        setattr(doctor, field, value)
    doctor.accepted_insurance_plans = json.dumps(plans) if plans else None
    if password:
        doctor.password_hash = hash_password(password)
    db.flush()
    db.refresh(doctor)
    return doctor


@doctors_router.delete("/{doctor_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_doctor(
    doctor_id: int,
    _admin: Patient = Depends(require_admin),
    db: Session = Depends(get_db_session),
):
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found.")
    db.delete(doctor)
