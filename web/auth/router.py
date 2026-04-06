from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database.db import get_db_session
from models.patient import Patient
from web.auth.schemas import LoginInSchema, RegisterInSchema, TokenOutSchema, PatientOutSchema
from web.auth.security import create_access_token, hash_password, verify_password

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
    )
    db.add(patient)
    db.flush()
    db.refresh(patient)
    return patient


@auth_router.post("/login", response_model=TokenOutSchema)
def login(body: LoginInSchema, db: Session = Depends(get_db_session)):
    patient = db.query(Patient).filter(Patient.email == body.email).first()
    if not patient or not verify_password(body.password, patient.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )
    token = create_access_token(patient.id)
    return {"access_token": token}
