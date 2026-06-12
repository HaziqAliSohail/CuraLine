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
