from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database.db import get_db_session
from models.doctor import Doctor
from models.patient import Patient
from datetime import time

from web.auth.schemas import (
    DoctorApplyInSchema,
    DoctorApplyOutSchema,
    LoginInSchema,
    RegisterInSchema,
    TokenOutSchema,
    PatientOutSchema,
)
from web.auth.security import ROLE_DOCTOR, create_access_token, hash_password, verify_password

auth_router = APIRouter()


@auth_router.post("/register", response_model=PatientOutSchema, status_code=status.HTTP_201_CREATED)
def register(body: RegisterInSchema, db: Session = Depends(get_db_session)):
    existing = db.query(Patient).filter(Patient.email == body.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered.")

    patient = Patient(
        name=body.name,
        gender=body.gender,
        phone=body.phone,
        email=body.email,
        password_hash=hash_password(body.password),
        medical_history=body.medical_history,
        insurance_plan=body.insurance_plan,
    )
    db.add(patient)
    db.flush()
    db.refresh(patient)
    return patient


# Pre-computed hash used to equalize login timing when the email does not
# exist, so response time cannot be used to enumerate registered accounts.
_DUMMY_PASSWORD_HASH = hash_password("timing-equalization-dummy")


@auth_router.post("/login", response_model=TokenOutSchema)
def login(body: LoginInSchema, db: Session = Depends(get_db_session)):
    patient = db.query(Patient).filter(Patient.email == body.email).first()
    if not patient:
        verify_password(body.password, _DUMMY_PASSWORD_HASH)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )
    if not verify_password(body.password, patient.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )
    token = create_access_token(patient.id)
    return {"access_token": token}


@auth_router.post("/doctor/login", response_model=TokenOutSchema)
def doctor_login(body: LoginInSchema, db: Session = Depends(get_db_session)):
    """Login for doctor portal accounts (admin-provisioned or approved applications)."""
    doctor = db.query(Doctor).filter(Doctor.email == body.email).first()
    if not doctor or not doctor.password_hash:
        verify_password(body.password, _DUMMY_PASSWORD_HASH)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )
    if not verify_password(body.password, doctor.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )
    # Application gate — only verified doctors may enter the portal.
    # (Checked after password verification so unauthenticated callers cannot
    # probe which emails have pending applications.)
    if doctor.application_status == Doctor.PENDING:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your application is under review. You'll be able to sign in once your credentials are verified.",
        )
    if doctor.application_status != Doctor.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your application was not approved. Please contact the hospital administration.",
        )
    token = create_access_token(doctor.id, role=ROLE_DOCTOR)
    return {"access_token": token}


@auth_router.post("/doctor/apply", response_model=DoctorApplyOutSchema, status_code=status.HTTP_201_CREATED)
def doctor_apply(body: DoctorApplyInSchema, db: Session = Depends(get_db_session)):
    """Self-serve doctor application. The account is created in PENDING state —
    invisible to patients and unable to log in — until an admin verifies the
    medical license and approves it."""
    existing = db.query(Doctor).filter(Doctor.email == body.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An application or account with this email already exists.",
        )

    doctor = Doctor(
        name=body.name,
        gender=body.gender,
        phone=body.phone,
        email=body.email,
        password_hash=hash_password(body.password),
        specialization=body.specialization,
        qualification=body.qualification,
        license_number=body.license_number,
        application_status=Doctor.PENDING,
        # Placeholder operating defaults — the doctor refines these in the
        # portal after approval.
        availability_status=Doctor.AVAILABLE,
        consultation_fee=0,
        reporting_time=time(9, 0),
        leaving_time=time(17, 0),
    )
    db.add(doctor)
    db.flush()
    db.refresh(doctor)

    from clients import emailer
    emailer.application_received(doctor.email, doctor.name)
    return doctor
