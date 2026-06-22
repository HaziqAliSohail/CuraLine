from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database.db import get_db_session
from models.device_token import DeviceToken
from web.auth.security import get_current_actor

notifications_router = APIRouter()


class DeviceRegisterSchema(BaseModel):
    expo_push_token: str = Field(..., min_length=10, max_length=200)


@notifications_router.post("/devices", status_code=status.HTTP_204_NO_CONTENT)
def register_device(
    body: DeviceRegisterSchema,
    actor: tuple = Depends(get_current_actor),
    db: Session = Depends(get_db_session),
):
    """Register (or re-bind) this device for push notifications.
    Idempotent - re-registering the same token updates its owner, which
    handles shared devices and account switching."""
    role, subject_id = actor
    existing = db.query(DeviceToken).filter(
        DeviceToken.expo_push_token == body.expo_push_token
    ).first()
    if existing:
        existing.subject_id = subject_id
        existing.role = role
    else:
        db.add(DeviceToken(subject_id=subject_id, role=role, expo_push_token=body.expo_push_token))
    db.flush()


@notifications_router.post("/devices/unregister", status_code=status.HTTP_204_NO_CONTENT)
def unregister_device(
    body: DeviceRegisterSchema,
    actor: tuple = Depends(get_current_actor),
    db: Session = Depends(get_db_session),
):
    """Remove a device on logout so signed-out phones stop receiving pushes."""
    role, subject_id = actor
    db.query(DeviceToken).filter(
        DeviceToken.expo_push_token == body.expo_push_token,
        DeviceToken.subject_id == subject_id,
        DeviceToken.role == role,
    ).delete()
    db.flush()
