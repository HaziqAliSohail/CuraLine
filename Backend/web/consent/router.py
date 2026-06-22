"""Medical-disclaimer consent.

Triage is a regulated, safety-sensitive action, so a patient must accept the
current consent/disclaimer before using it. Acceptance is versioned: bump
CURRENT_CONSENT_VERSION whenever the wording changes and every patient is
re-prompted. The acceptance is enforced server-side (see require_consent, used
by the inference endpoint) — not just in the UI.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from database.db import get_db_session
from models.patient import Patient
from web.audit import client_ip, record_audit
from web.auth.security import get_current_patient

consent_router = APIRouter()

# Bump this string whenever the disclaimer text changes — patients are re-prompted.
CURRENT_CONSENT_VERSION = "2026-06-17"

CONSENT_TITLE = "Before we begin"

CONSENT_TEXT = (
    "CuraLine helps you book the right doctor by triaging your symptoms. It is "
    "informational only — it is NOT a medical diagnosis, NOT a substitute for "
    "professional medical care, and NOT for emergencies.\n\n"
    "If you think you may be having a medical emergency, call 911 or go to the "
    "nearest emergency room now.\n\n"
    "By continuing, you confirm you understand this and consent to CuraLine "
    "processing the symptoms you describe to match you with care."
)


def require_consent(patient: Patient) -> None:
    """Raise 403 if the patient hasn't accepted the current consent version."""
    if patient.consent_version != CURRENT_CONSENT_VERSION:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "consent_required", "version": CURRENT_CONSENT_VERSION},
        )


@consent_router.get("/")
def get_consent(current_patient: Patient = Depends(get_current_patient)):
    """The current disclaimer + whether this patient has accepted it."""
    return {
        "version": CURRENT_CONSENT_VERSION,
        "title": CONSENT_TITLE,
        "text": CONSENT_TEXT,
        "accepted": current_patient.consent_version == CURRENT_CONSENT_VERSION,
        "accepted_version": current_patient.consent_version,
        "accepted_at": current_patient.consent_accepted_at,
    }


@consent_router.post("/accept")
def accept_consent(
    request: Request,
    current_patient: Patient = Depends(get_current_patient),
    db: Session = Depends(get_db_session),
):
    """Record acceptance of the current consent version (append-only audit)."""
    current_patient.consent_version = CURRENT_CONSENT_VERSION
    current_patient.consent_accepted_at = datetime.now(timezone.utc)
    record_audit(
        db, actor_role="patient", actor_id=current_patient.id,
        action="consent.accept", target_type="patient", target_id=current_patient.id,
        detail={"version": CURRENT_CONSENT_VERSION},
        ip_address=client_ip(request),
    )
    db.flush()
    return {"accepted": True, "version": CURRENT_CONSENT_VERSION}
