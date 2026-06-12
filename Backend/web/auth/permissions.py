from fastapi import Depends, HTTPException, status

from models.patient import Patient
from web.auth.security import get_current_patient


def require_admin(current_patient: Patient = Depends(get_current_patient)) -> Patient:
    """
    FastAPI dependency that ensures the current user is an admin.
    Raises HTTP 403 if the patient does not have is_admin=True.
    """
    if not current_patient.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )
    return current_patient
