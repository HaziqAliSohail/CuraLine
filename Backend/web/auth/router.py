from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database.db import get_db_session
from models.doctor import Doctor
from models.patient import Patient
from datetime import time

from settings import settings
from web.auth.schemas import (
    DoctorApplyInSchema,
    DoctorApplyOutSchema,
    ForgotPasswordInSchema,
    HospitalApplyInSchema,
    InviteAcceptInSchema,
    InviteInfoOutSchema,
    LoginInSchema,
    RefreshInSchema,
    RegisterInSchema,
    ResetPasswordInSchema,
    TokenOutSchema,
    PatientOutSchema,
    VerifyEmailInSchema,
)
from web.auth.security import (
    ROLE_ADMIN,
    ROLE_DOCTOR,
    ROLE_PATIENT,
    create_access_token,
    hash_password,
    hash_refresh_token,
    issue_refresh_token,
    revoke_all_refresh_tokens,
    verify_password,
)
from web.auth.ratelimit import rate_limit

auth_router = APIRouter()

# Per-IP throttles, applied in-app so they hold even without nginx in front.
_login_limit = rate_limit("login", limit=10, window_seconds=60)
_register_limit = rate_limit("register", limit=5, window_seconds=60)
_refresh_limit = rate_limit("refresh", limit=30, window_seconds=60)
_reset_limit = rate_limit("reset", limit=5, window_seconds=60)
# Self-serve onboarding is unauthenticated and writes rows + sends mail, so it
# needs the same abuse protection as registration (anti email-bomb / row spam).
_apply_limit = rate_limit("apply", limit=5, window_seconds=60)


def _hours_from_now(hours: int):
    from datetime import datetime, timezone, timedelta
    return datetime.now(timezone.utc) + timedelta(hours=hours)


def _send_verification_email(db, patient) -> None:
    """Issue a fresh single-use verification token and email the link."""
    import secrets
    raw = secrets.token_urlsafe(32)
    patient.verification_token_hash = hash_refresh_token(raw)
    patient.verification_expires_at = _hours_from_now(24)
    db.flush()
    from clients import emailer
    emailer.verify_email(
        patient.email, patient.name,
        f"{settings.frontend_base_url}/verify-email/{raw}",
    )


@auth_router.post(
    "/register",
    response_model=PatientOutSchema,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_register_limit)],
)
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
    _send_verification_email(db, patient)
    return patient


# Pre-computed hash used to equalize login timing when the email does not
# exist, so response time cannot be used to enumerate registered accounts.
_DUMMY_PASSWORD_HASH = hash_password("timing-equalization-dummy")


@auth_router.post("/login", response_model=TokenOutSchema, dependencies=[Depends(_login_limit)])
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
    return {
        "access_token": create_access_token(patient.id),
        "refresh_token": issue_refresh_token(db, patient.id, ROLE_PATIENT),
    }


@auth_router.post("/doctor/login", response_model=TokenOutSchema, dependencies=[Depends(_login_limit)])
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
    # Application gate - only verified doctors may enter the portal.
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
    return {
        "access_token": create_access_token(doctor.id, role=ROLE_DOCTOR),
        "refresh_token": issue_refresh_token(db, doctor.id, ROLE_DOCTOR),
    }


@auth_router.post("/admin/login", response_model=TokenOutSchema, dependencies=[Depends(_login_limit)])
def admin_login(body: LoginInSchema, db: Session = Depends(get_db_session)):
    """Login for platform operators. A separate identity (PlatformAdmin) from
    patients, issuing an `admin`-role token."""
    from models.platform_admin import PlatformAdmin
    admin = db.query(PlatformAdmin).filter(PlatformAdmin.email == body.email).first()
    if not admin:
        verify_password(body.password, _DUMMY_PASSWORD_HASH)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )
    if not verify_password(body.password, admin.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )
    return {
        "access_token": create_access_token(admin.id, role=ROLE_ADMIN),
        "refresh_token": issue_refresh_token(db, admin.id, ROLE_ADMIN),
    }


@auth_router.post("/refresh", response_model=TokenOutSchema, dependencies=[Depends(_refresh_limit)])
def refresh_session(body: RefreshInSchema, db: Session = Depends(get_db_session)):
    """Exchange a valid refresh token for a new access + refresh pair.

    Rotation with reuse detection: each refresh token is single-use. Presenting
    an already-rotated token is treated as theft and revokes every active
    session for that account.
    """
    from datetime import datetime, timezone
    from models.refresh_token import RefreshToken

    invalid = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired session. Please sign in again.",
    )

    record = db.query(RefreshToken).filter(
        RefreshToken.token_hash == hash_refresh_token(body.refresh_token)
    ).first()
    if not record:
        raise invalid

    if record.revoked:
        # Reuse of a rotated token - assume compromise, kill the whole family.
        # Commit explicitly: raising the 401 skips the session's normal commit,
        # and this security write must survive the error response.
        revoke_all_refresh_tokens(db, record.subject_id, record.role)
        db.commit()
        raise invalid

    expires = record.expires_at
    if expires is not None and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires is None or expires < datetime.now(timezone.utc):
        record.revoked = True
        db.commit()  # must survive the 401 (see above)
        raise invalid

    record.revoked = True
    db.flush()
    return {
        "access_token": create_access_token(record.subject_id, role=record.role),
        "refresh_token": issue_refresh_token(db, record.subject_id, record.role),
    }


@auth_router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(body: RefreshInSchema, db: Session = Depends(get_db_session)):
    """Revoke a refresh token. Always succeeds - logging out can't fail."""
    from models.refresh_token import RefreshToken

    record = db.query(RefreshToken).filter(
        RefreshToken.token_hash == hash_refresh_token(body.refresh_token)
    ).first()
    if record:
        record.revoked = True
        db.flush()


@auth_router.post("/verify-email")
def verify_email(body: VerifyEmailInSchema, db: Session = Depends(get_db_session)):
    """Confirm a patient's email from the link in the verification email."""
    from datetime import datetime, timezone
    invalid = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="This verification link is invalid or has expired.",
    )
    patient = db.query(Patient).filter(
        Patient.verification_token_hash == hash_refresh_token(body.token)
    ).first()
    if not patient:
        raise invalid
    exp = patient.verification_expires_at
    if exp is not None and exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp is None or exp < datetime.now(timezone.utc):
        raise invalid
    patient.email_verified = True
    patient.verification_token_hash = None
    patient.verification_expires_at = None
    db.flush()
    return {"verified": True}


@auth_router.post("/forgot-password", dependencies=[Depends(_reset_limit)])
def forgot_password(body: ForgotPasswordInSchema, db: Session = Depends(get_db_session)):
    """Start a password reset. Always returns the same response so the endpoint
    can't be used to discover which emails are registered."""
    import secrets
    patient = db.query(Patient).filter(Patient.email == body.email).first()
    if patient:
        raw = secrets.token_urlsafe(32)
        patient.reset_token_hash = hash_refresh_token(raw)
        patient.reset_expires_at = _hours_from_now(1)
        db.flush()
        from clients import emailer
        emailer.password_reset(
            patient.email, patient.name,
            f"{settings.frontend_base_url}/reset-password/{raw}",
        )
    return {"message": "If an account exists for that email, a reset link has been sent."}


@auth_router.post("/reset-password", dependencies=[Depends(_reset_limit)])
def reset_password(body: ResetPasswordInSchema, db: Session = Depends(get_db_session)):
    """Set a new password from a reset link, then revoke all existing sessions."""
    from datetime import datetime, timezone
    invalid = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="This reset link is invalid or has expired.",
    )
    patient = db.query(Patient).filter(
        Patient.reset_token_hash == hash_refresh_token(body.token)
    ).first()
    if not patient:
        raise invalid
    exp = patient.reset_expires_at
    if exp is not None and exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp is None or exp < datetime.now(timezone.utc):
        raise invalid
    patient.password_hash = hash_password(body.new_password)
    patient.reset_token_hash = None
    patient.reset_expires_at = None
    # A reset invalidates every active session for the account.
    revoke_all_refresh_tokens(db, patient.id, ROLE_PATIENT)
    db.flush()
    return {"message": "Your password has been updated. Please sign in."}


@auth_router.post("/doctor/apply", response_model=DoctorApplyOutSchema, status_code=status.HTTP_201_CREATED, dependencies=[Depends(_apply_limit)])
def doctor_apply(body: DoctorApplyInSchema, db: Session = Depends(get_db_session)):
    """Self-serve doctor application. The account is created in PENDING state -
    invisible to patients and unable to log in - until an admin verifies the
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
        npi_number=body.npi_number,
        hospital_id=body.hospital_id,
        application_status=Doctor.PENDING,
        # Placeholder operating defaults - the doctor refines these in the
        # portal after approval.
        availability_status=Doctor.AVAILABLE,
        consultation_fee=0,
        reporting_time=time(9, 0),
        leaving_time=time(17, 0),
    )
    db.add(doctor)
    db.flush()
    db.refresh(doctor)

    # Independent doctors (no hospital to vouch for them) are verified by the
    # platform. If they supply an NPI that matches the CMS registry, fast-track
    # them to APPROVED; otherwise they wait for manual platform review. A
    # registry outage returns ERROR (never raises), so it safely falls back.
    auto_approved = False
    if doctor.hospital_id is None and doctor.npi_number:
        from clients import npi as npi_client
        result = npi_client.verify_npi(doctor.npi_number, doctor.name)
        doctor.npi_verification_status = result["status"]
        if result["status"] == npi_client.VERIFIED:
            doctor.application_status = Doctor.APPROVED
            auto_approved = True
        db.flush()
        db.refresh(doctor)

    from clients import emailer
    if auto_approved:
        emailer.application_approved(doctor.email, doctor.name)
    else:
        emailer.application_received(doctor.email, doctor.name)
    return doctor


@auth_router.post("/hospital/apply", status_code=status.HTTP_201_CREATED, dependencies=[Depends(_apply_limit)])
def hospital_apply(body: HospitalApplyInSchema, db: Session = Depends(get_db_session)):
    """Self-serve hospital/clinic onboarding. Creates a PENDING hospital plus a
    hospital-admin account (a Doctor flagged is_hospital_admin). The platform
    operator verifies the hospital before its admin can approve doctors."""
    from models.hospital import Hospital
    if db.query(Doctor).filter(Doctor.email == body.admin_email).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    hospital = Hospital(
        name=body.hospital_name,
        address=body.address,
        phone=body.phone,
        org_npi=body.org_npi,
        verification_status=Hospital.PENDING,
    )
    db.add(hospital)
    db.flush()

    admin = Doctor(
        name=body.admin_name,
        gender="OTHER",
        email=body.admin_email,
        password_hash=hash_password(body.admin_password),
        specialization="Administration",
        qualification="Hospital Administrator",
        availability_status=Doctor.OFFLINE,  # not a bookable provider
        consultation_fee=0,
        reporting_time=time(9, 0),
        leaving_time=time(17, 0),
        application_status=Doctor.APPROVED,   # can sign in immediately…
        hospital_id=hospital.id,
        is_hospital_admin=True,               # …but hospital stays PENDING until verified
    )
    db.add(admin)
    db.flush()
    return {
        "hospital_id": hospital.id,
        "hospital_status": hospital.verification_status,
        "admin_email": admin.email,
    }


def _get_valid_invite(token: str, db: Session) -> Doctor:
    """Resolve a one-time invite token or raise the appropriate error."""
    from datetime import datetime, timezone

    doctor = db.query(Doctor).filter(Doctor.invite_token == token).first()
    if not doctor or doctor.password_hash:
        # Unknown token, or invite already consumed
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This invite link is invalid or has already been used.",
        )
    expires = doctor.invite_expires_at
    if expires is not None and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires is None or expires < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This invite link has expired. Ask your administrator to send a new one.",
        )
    return doctor


@auth_router.get("/doctor/invite/{token}", response_model=InviteInfoOutSchema)
def get_invite_info(token: str, db: Session = Depends(get_db_session)):
    """Public: who this invite is for (drives the set-password page)."""
    return _get_valid_invite(token, db)


@auth_router.post("/doctor/invite/{token}/accept", response_model=TokenOutSchema)
def accept_invite(token: str, body: InviteAcceptInSchema, db: Session = Depends(get_db_session)):
    """Set the password for an invited doctor and consume the token.
    Returns a portal access token so the doctor lands signed in."""
    doctor = _get_valid_invite(token, db)
    # Invites are only meant for admin-approved accounts; never let one grant
    # portal access to a doctor who isn't approved.
    if doctor.application_status != Doctor.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is not approved for portal access.",
        )
    doctor.password_hash = hash_password(body.password)
    doctor.invite_token = None
    doctor.invite_expires_at = None
    db.flush()
    return {
        "access_token": create_access_token(doctor.id, role=ROLE_DOCTOR),
        "refresh_token": issue_refresh_token(db, doctor.id, ROLE_DOCTOR),
    }
