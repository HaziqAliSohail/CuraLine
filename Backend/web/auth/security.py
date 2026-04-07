from datetime import datetime, timedelta

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from database.db import get_db_session
from models.patient import Patient
from settings import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/v1/auth/login")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(patient_id: int) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    return jwt.encode(
        {"sub": str(patient_id), "exp": expire},
        settings.secret_key,
        algorithm=settings.algorithm,
    )


def get_current_patient(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db_session),
) -> Patient:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        patient_id: str = payload.get("sub")
        if patient_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    patient = db.query(Patient).filter(Patient.id == int(patient_id)).first()
    if patient is None:
        raise credentials_exception
    return patient
