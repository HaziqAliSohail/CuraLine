from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from database.db import get_db_session
from models.doctor import Doctor
from models.patient import Patient
from settings import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/v1/auth/login")

ROLE_PATIENT = "patient"
ROLE_DOCTOR = "doctor"
ROLE_ADMIN = "admin"


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(subject_id: int, role: str = ROLE_PATIENT) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    return jwt.encode(
        {"sub": str(subject_id), "role": role, "exp": expire},
        settings.secret_key,
        algorithm=settings.algorithm,
    )


def hash_refresh_token(raw_token: str) -> str:
    import hashlib
    return hashlib.sha256(raw_token.encode()).hexdigest()


def issue_refresh_token(db: Session, subject_id: int, role: str) -> str:
    """Create a refresh token row (hash only) and return the raw token."""
    import secrets
    from models.refresh_token import RefreshToken

    raw = secrets.token_urlsafe(48)
    db.add(RefreshToken(
        subject_id=subject_id,
        role=role,
        token_hash=hash_refresh_token(raw),
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days),
    ))
    db.flush()
    return raw


def revoke_all_refresh_tokens(db: Session, subject_id: int, role: str) -> None:
    """Kill every active session for a subject (password change, theft response)."""
    from models.refresh_token import RefreshToken
    db.query(RefreshToken).filter(
        RefreshToken.subject_id == subject_id,
        RefreshToken.role == role,
        RefreshToken.revoked == False,  # noqa: E712
    ).update({"revoked": True})
    db.flush()


def get_current_actor(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db_session),
) -> tuple[str, int]:
    """Role-agnostic auth: returns (role, subject_id) for either portal.
    Used by endpoints that serve both patients and doctors (e.g. push devices)."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    subject_id, role = _decode_token(token)
    if role == ROLE_DOCTOR:
        exists = db.query(Doctor.id).filter(Doctor.id == subject_id).first()
    elif role == ROLE_ADMIN:
        from models.platform_admin import PlatformAdmin
        exists = db.query(PlatformAdmin.id).filter(PlatformAdmin.id == subject_id).first()
    else:
        exists = db.query(Patient.id).filter(Patient.id == subject_id).first()
    if not exists:
        raise credentials_exception
    return role, subject_id


def _decode_token(token: str) -> tuple[int, str]:
    """Return (subject_id, role) or raise 401."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        subject_str = payload.get("sub")
        if subject_str is None:
            raise credentials_exception
        # Guard against malformed sub claim (e.g. float, string, None)
        try:
            subject_id = int(subject_str)
        except (TypeError, ValueError):
            raise credentials_exception
        # Tokens issued before roles existed default to patient
        role = payload.get("role", ROLE_PATIENT)
    except JWTError:
        raise credentials_exception
    return subject_id, role


def get_current_patient(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db_session),
) -> Patient:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    patient_id, role = _decode_token(token)
    if role != ROLE_PATIENT:
        raise credentials_exception
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if patient is None:
        raise credentials_exception
    return patient


def get_current_doctor(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db_session),
) -> Doctor:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    doctor_id, role = _decode_token(token)
    if role != ROLE_DOCTOR:
        raise credentials_exception
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if doctor is None:
        raise credentials_exception
    return doctor


def get_current_admin(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db_session),
):
    """Resolve a platform operator from an `admin`-role token. The admin is a
    first-class identity (PlatformAdmin), never a patient with a flag.

    Missing/invalid token -> 401; a valid but non-admin token (e.g. a patient or
    doctor) -> 403, since the caller is authenticated but lacks the privilege.
    """
    from models.platform_admin import PlatformAdmin
    admin_id, role = _decode_token(token)  # 401 on missing/invalid token
    if role != ROLE_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )
    admin = db.query(PlatformAdmin).filter(PlatformAdmin.id == admin_id).first()
    if admin is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return admin
