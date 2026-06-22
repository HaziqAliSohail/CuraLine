"""Copay payment intents for a patient's appointment."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from clients import payments
from database.db import get_db_session
from models.appointment import Appointment
from models.patient import Patient
from settings import settings
from web.auth.security import get_current_patient

payments_router = APIRouter()


@payments_router.post("/appointments/{appointment_id}/copay-checkout")
def create_copay_checkout(
    appointment_id: int,
    current_patient: Patient = Depends(get_current_patient),
    db: Session = Depends(get_db_session),
):
    """Create a Stripe Checkout Session for this appointment's copay and return
    the redirect URL. The backend never charges directly — Stripe handles the
    card flow on its hosted page."""
    appt = db.query(Appointment).filter(
        Appointment.id == appointment_id,
        Appointment.patient_id == current_patient.id,
    ).first()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found.")

    base = settings.frontend_base_url.rstrip("/")
    result = payments.create_checkout(
        settings.default_copay_cents,
        success_url=f"{base}/appointments?copay=success",
        cancel_url=f"{base}/appointments?copay=cancelled",
        metadata={"appointment_id": appointment_id, "patient_id": current_patient.id},
    )
    message = "Redirecting to secure checkout." if result["enabled"] else "Payments aren't enabled yet."
    return {**result, "message": message}
