from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database.db import get_db_session
from models.patient import Patient
from web.auth.schemas import PatientOutSchema
from web.auth.security import get_current_patient

patients_router = APIRouter()


@patients_router.get("/me", response_model=PatientOutSchema)
def get_my_profile(current_patient: Patient = Depends(get_current_patient)):
    return current_patient
