import json

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from database.db import get_db_session
from models.doctor import Doctor
from models.hospital import Hospital
from web.audit import client_ip, record_audit
from web.auth.permissions import require_admin
from web.auth.security import hash_password, get_current_actor, ROLE_ADMIN, ROLE_PATIENT, ROLE_DOCTOR
from fastapi import Query


def _admin_scope(db, actor):
    """Resolve the caller's approval authority:
      ("platform", None) - a platform operator: can decide any application
      ("hospital", id)   - a VERIFIED hospital's admin: only that hospital's docs
      None               - not authorized
    """
    role, subject_id = actor
    if role == ROLE_ADMIN:
        return ("platform", None)
    elif role == ROLE_DOCTOR:
        d = db.get(Doctor, subject_id)
        if d and d.is_hospital_admin and d.hospital_id:
            h = db.get(Hospital, d.hospital_id)
            if h and h.verification_status == Hospital.VERIFIED:
                return ("hospital", d.hospital_id)
    return None

from web.doctors.schemas import (
    ApplicationDecisionSchema,
    DoctorApplicationOutSchema,
    DoctorInSchema,
    DoctorInviteInSchema,
    DoctorInviteOutSchema,
    DoctorOutSchema,
    DoctorPublicOutSchema,
    NpiVerificationOutSchema,
)

doctors_router = APIRouter()


@doctors_router.get("/", response_model=list[DoctorPublicOutSchema])
def list_doctors(
    specialization: str | None = None,
    availability_status: str | None = None,
    insurance: str | None = None,
    hospital_id: int | None = None,
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db_session),
):
    # Patients only ever see verified (approved) doctors. Contact PII is
    # excluded by DoctorPublicOutSchema; results are bounded (max 200/page).
    query = db.query(Doctor).filter(
        Doctor.application_status == Doctor.APPROVED,
        Doctor.is_hospital_admin == False,  # noqa: E712  hide admin accounts
    )
    if hospital_id:
        query = query.filter(Doctor.hospital_id == hospital_id)
    if specialization:
        query = query.filter(Doctor.specialization.ilike(f"%{specialization}%"))
    if availability_status:
        query = query.filter(Doctor.availability_status == availability_status)
    if insurance:
        # JSON-encoded list stored in a Text column - use LIKE for portability
        query = query.filter(Doctor.accepted_insurance_plans.ilike(f'%"{insurance}"%'))
    return query.order_by(Doctor.rating.desc(), Doctor.id).offset(offset).limit(limit).all()


@doctors_router.post("/invite", response_model=DoctorInviteOutSchema, status_code=status.HTTP_201_CREATED)
def invite_doctor(
    body: DoctorInviteInSchema,
    _admin = Depends(require_admin),
    db: Session = Depends(get_db_session),
):
    """Admin: invite a vetted doctor. Creates an APPROVED account with no
    password and emails a one-time set-password link (7-day expiry)."""
    import secrets
    from datetime import datetime, time, timedelta, timezone

    from settings import settings

    existing = db.query(Doctor).filter(Doctor.email == body.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A doctor with this email already exists.",
        )

    token = secrets.token_urlsafe(32)
    doctor = Doctor(
        **body.model_dump(),
        application_status=Doctor.APPROVED,  # admin-vetted by definition
        invite_token=token,
        invite_expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        availability_status=Doctor.AVAILABLE,
        consultation_fee=0,
        reporting_time=time(9, 0),
        leaving_time=time(17, 0),
    )
    db.add(doctor)
    db.flush()
    db.refresh(doctor)

    invite_link = f"{settings.frontend_base_url.rstrip('/')}/invite/{token}"
    from clients import emailer
    emailer.doctor_invite(doctor.email, doctor.name, invite_link)

    return {
        "id": doctor.id,
        "name": doctor.name,
        "email": doctor.email,
        "invite_link": invite_link,
        "expires_in_days": 7,
    }


# NOTE: declared before /{doctor_id} so "applications" is not parsed as an id
@doctors_router.get("/applications", response_model=list[DoctorApplicationOutSchema])
def list_doctor_applications(
    application_status: str = "PENDING",
    actor: tuple = Depends(get_current_actor),
    db: Session = Depends(get_db_session),
):
    """Review doctor onboarding applications. Platform admins see all; a verified
    hospital's admin sees only their own hospital's applications."""
    scope = _admin_scope(db, actor)
    if scope is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required.")
    if application_status not in Doctor.APPLICATION_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"application_status must be one of {Doctor.APPLICATION_STATUSES}.",
        )
    q = db.query(Doctor).filter(
        Doctor.application_status == application_status,
        Doctor.is_hospital_admin == False,  # noqa: E712  don't list admin accounts
    )
    if scope[0] == "hospital":
        q = q.filter(Doctor.hospital_id == scope[1])
    return q.order_by(Doctor.created_at).all()


@doctors_router.put("/{doctor_id}/application", response_model=DoctorApplicationOutSchema)
def decide_doctor_application(
    doctor_id: int,
    body: ApplicationDecisionSchema,
    request: Request,
    actor: tuple = Depends(get_current_actor),
    db: Session = Depends(get_db_session),
):
    """Approve/reject a pending doctor application. Platform admins can decide
    any; a verified hospital's admin can only decide its own hospital's doctors."""
    scope = _admin_scope(db, actor)
    if scope is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required.")
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found.")
    if scope[0] == "hospital" and doctor.hospital_id != scope[1]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only decide applications for your own hospital.",
        )
    if doctor.application_status != Doctor.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This application has already been decided.",
        )
    doctor.application_status = Doctor.APPROVED if body.action == "approve" else Doctor.REJECTED
    record_audit(
        db, actor_role="admin", actor_id=actor[1],
        action=f"doctor.application_{body.action}", target_type="doctor", target_id=doctor.id,
        ip_address=client_ip(request),
    )
    db.flush()
    db.refresh(doctor)

    if doctor.email:
        from clients import emailer
        if doctor.application_status == Doctor.APPROVED:
            emailer.application_approved(doctor.email, doctor.name)
        else:
            emailer.application_rejected(doctor.email, doctor.name)
    return doctor


@doctors_router.post("/{doctor_id}/verify-npi", response_model=NpiVerificationOutSchema)
def verify_doctor_npi(
    doctor_id: int,
    _admin = Depends(require_admin),
    db: Session = Depends(get_db_session),
):
    """Admin: check the doctor's NPI against the CMS NPI Registry and store
    the result. Registry outages return ERROR - fall back to manual review."""
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found.")
    if not doctor.npi_number:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="This doctor has no NPI number on file.",
        )

    from clients.npi import verify_npi
    result = verify_npi(doctor.npi_number, doctor.name)
    doctor.npi_verification_status = result["status"]
    db.flush()

    return {
        "doctor_id": doctor.id,
        "npi_number": doctor.npi_number,
        "status": result["status"],
        "registry_name": result["registry_name"],
        "taxonomy": result["taxonomy"],
    }


@doctors_router.get("/{doctor_id}", response_model=DoctorPublicOutSchema)
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
    _admin = Depends(require_admin),
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
    _admin = Depends(require_admin),
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
    request: Request,
    _admin = Depends(require_admin),
    db: Session = Depends(get_db_session),
):
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found.")
    record_audit(
        db, actor_role="admin", actor_id=_admin.id,
        action="doctor.delete", target_type="doctor", target_id=doctor.id,
        detail={"name": doctor.name, "specialization": doctor.specialization},
        ip_address=client_ip(request),
    )
    db.delete(doctor)
