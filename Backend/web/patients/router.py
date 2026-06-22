from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database.db import get_db_session
from models.patient import Patient
from web.audit import client_ip, record_audit
from web.auth.schemas import PatientOutSchema
from web.auth.security import (
    ROLE_PATIENT,
    get_current_patient,
    hash_password,
    revoke_all_refresh_tokens,
    verify_password,
)

patients_router = APIRouter()


class PatientUpdateSchema(BaseModel):
    name: str | None = Field(default=None, max_length=50)
    gender: str | None = Field(default=None, pattern="^(MALE|FEMALE|OTHER)$")
    phone: str | None = None
    medical_history: str | None = None
    insurance_plan: str | None = None
    insurance_member_id: str | None = Field(default=None, max_length=50)
    insurance_group_number: str | None = Field(default=None, max_length=50)
    allow_severity_swap: bool | None = None


@patients_router.get("/me", response_model=PatientOutSchema)
def get_my_profile(current_patient: Patient = Depends(get_current_patient)):
    return current_patient


@patients_router.put("/me", response_model=PatientOutSchema)
def update_my_profile(
    body: PatientUpdateSchema,
    current_patient: Patient = Depends(get_current_patient),
    db: Session = Depends(get_db_session),
):
    """Allow patients to update their name, gender, phone, medical history, and insurance plan."""
    if body.name is not None:
        name = body.name.strip()
        if not name:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Name cannot be empty.",
            )
        current_patient.name = name
    if body.gender is not None:
        current_patient.gender = body.gender
    if body.phone is not None:
        current_patient.phone = body.phone
    if body.medical_history is not None:
        current_patient.medical_history = body.medical_history
    if body.insurance_plan is not None:
        current_patient.insurance_plan = body.insurance_plan
    if body.insurance_member_id is not None:
        current_patient.insurance_member_id = body.insurance_member_id
    if body.insurance_group_number is not None:
        current_patient.insurance_group_number = body.insurance_group_number
    if body.allow_severity_swap is not None:
        current_patient.allow_severity_swap = body.allow_severity_swap
    db.flush()
    db.refresh(current_patient)
    return current_patient


@patients_router.get("/me/export")
def export_my_data(
    request: Request,
    current_patient: Patient = Depends(get_current_patient),
    db: Session = Depends(get_db_session),
):
    """Patient data-portability: a full JSON export of everything we hold about
    this account (decrypted, since it's the patient's own data)."""
    from models.appointment import Appointment
    from models.review import Review

    appts = db.query(Appointment).filter(Appointment.patient_id == current_patient.id).all()
    reviews = db.query(Review).filter(Review.patient_id == current_patient.id).all()

    payload = {
        "generated_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
        "profile": {
            "id": current_patient.id,
            "name": current_patient.name,
            "email": current_patient.email,
            "gender": current_patient.gender,
            "phone": current_patient.phone,
            "medical_history": current_patient.medical_history,
            "insurance_plan": current_patient.insurance_plan,
            "insurance_member_id": current_patient.insurance_member_id,
            "insurance_group_number": current_patient.insurance_group_number,
            "email_verified": current_patient.email_verified,
            "consent_version": current_patient.consent_version,
            "consent_accepted_at": current_patient.consent_accepted_at.isoformat() if current_patient.consent_accepted_at else None,
        },
        "appointments": [
            {
                "id": a.id, "doctor_id": a.doctor_id, "slot_id": a.slot_id,
                "status": a.status, "reason": a.reason, "severity_score": a.severity_score,
            }
            for a in appts
        ],
        "reviews": [
            {"id": r.id, "doctor_id": r.doctor_id, "rating": r.rating, "comment": r.comment}
            for r in reviews
        ],
    }
    record_audit(
        db, actor_role="patient", actor_id=current_patient.id,
        action="patient.data_export", target_type="patient", target_id=current_patient.id,
        ip_address=client_ip(request),
    )
    db.flush()
    from fastapi.responses import JSONResponse
    return JSONResponse(
        content=payload,
        headers={"Content-Disposition": "attachment; filename=curaline-my-data.json"},
    )


@patients_router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_account(
    request: Request,
    current_patient: Patient = Depends(get_current_patient),
    db: Session = Depends(get_db_session),
):
    """Right-to-erasure: purge PHI, anonymize identity, free future slots, and
    revoke all sessions. Appointment rows are kept (anonymized) so doctors'
    historical records stay consistent, but all PHI on them is removed."""
    import secrets
    from models.appointment import Appointment
    from models.device_token import DeviceToken

    appts = db.query(Appointment).filter(Appointment.patient_id == current_patient.id).all()
    for a in appts:
        if a.status == Appointment.SCHEDULED and a.slot:
            a.status = Appointment.CANCELLED
            a.slot.is_available = True
        a.reason = None
        a.clinical_summary = None
        a.no_show_risk_reason = None
        a.conversation_history = None

    db.query(DeviceToken).filter(
        DeviceToken.subject_id == current_patient.id, DeviceToken.role == ROLE_PATIENT
    ).delete()
    revoke_all_refresh_tokens(db, current_patient.id, ROLE_PATIENT)

    pid = current_patient.id
    current_patient.name = "Deleted User"
    current_patient.email = f"deleted+{pid}@removed.invalid"
    current_patient.phone = None
    current_patient.medical_history = None
    current_patient.insurance_plan = None
    current_patient.insurance_member_id = None
    current_patient.insurance_group_number = None
    current_patient.password_hash = hash_password(secrets.token_urlsafe(32))

    record_audit(
        db, actor_role="patient", actor_id=pid,
        action="patient.account_deleted", target_type="patient", target_id=pid,
        ip_address=client_ip(request),
    )
    db.flush()


class PasswordChangeSchema(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)


@patients_router.put("/me/password", status_code=status.HTTP_204_NO_CONTENT)
def change_my_password(
    body: PasswordChangeSchema,
    request: Request,
    current_patient: Patient = Depends(get_current_patient),
    db: Session = Depends(get_db_session),
):
    """Let patients update their password, verifying the current password first."""
    if not current_patient.password_hash or not verify_password(
        body.current_password, current_patient.password_hash
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Current password is incorrect.",
        )
    current_patient.password_hash = hash_password(body.new_password)
    # Revoke session refresh tokens
    revoke_all_refresh_tokens(db, current_patient.id, ROLE_PATIENT)
    record_audit(
        db, actor_role="patient", actor_id=current_patient.id,
        action="patient.password_change", target_type="patient", target_id=current_patient.id,
        ip_address=client_ip(request),
    )
    db.flush()

