"""FHIR export endpoints (admin-only) for EHR interoperability."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from clients import fhir
from database.db import get_db_session
from models.appointment import Appointment
from web.auth.permissions import require_admin

fhir_router = APIRouter()


@fhir_router.get("/appointments/{appointment_id}")
def export_appointment_fhir(
    appointment_id: int,
    _admin=Depends(require_admin),
    db: Session = Depends(get_db_session),
):
    """Export an appointment + its patient as a FHIR R4 Bundle."""
    appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found.")
    return fhir.appointment_bundle(appt, appt.patient)
