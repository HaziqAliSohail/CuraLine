from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.db import get_db_session
from models.patient import Patient
from web.auth.schemas import PatientOutSchema
from web.auth.security import get_current_patient

patients_router = APIRouter()


class PatientUpdateSchema(BaseModel):
    phone: str | None = None
    medical_history: str | None = None
    insurance_plan: str | None = None


@patients_router.get("/me", response_model=PatientOutSchema)
def get_my_profile(current_patient: Patient = Depends(get_current_patient)):
    return current_patient


@patients_router.put("/me", response_model=PatientOutSchema)
def update_my_profile(
    body: PatientUpdateSchema,
    current_patient: Patient = Depends(get_current_patient),
    db: Session = Depends(get_db_session),
):
    """Allow patients to update their phone, medical history, and insurance plan."""
    if body.phone is not None:
        current_patient.phone = body.phone
    if body.medical_history is not None:
        current_patient.medical_history = body.medical_history
    if body.insurance_plan is not None:
        current_patient.insurance_plan = body.insurance_plan
    db.flush()
    db.refresh(current_patient)
    return current_patient
