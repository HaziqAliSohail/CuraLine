"""Telehealth video join links.

One endpoint serving both sides of a visit: the appointment's patient OR its
doctor can fetch the room URL. The room is created lazily on first request and
persisted on the appointment.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from clients import video
from database.db import get_db_session
from models.appointment import Appointment
from web.auth.security import ROLE_DOCTOR, ROLE_PATIENT, get_current_actor

video_router = APIRouter()


@video_router.get("/appointments/{appointment_id}/video")
def get_appointment_video(
    appointment_id: int,
    actor: tuple = Depends(get_current_actor),
    db: Session = Depends(get_db_session),
):
    role, subject_id = actor
    appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found.")

    # Only the appointment's own patient or doctor may join.
    owns = (role == ROLE_PATIENT and appt.patient_id == subject_id) or (
        role == ROLE_DOCTOR and appt.doctor_id == subject_id
    )
    if not owns:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your appointment.")

    info = video.get_room(appt.id, appt.video_room_url)
    # Persist a freshly created room so both parties land in the same one.
    if info["enabled"] and info["url"] and not appt.video_room_url:
        appt.video_room_url = info["url"]
        db.flush()

    message = (
        "Join the video visit." if info["enabled"]
        else "Video visits aren't enabled yet."
    )
    return {**info, "message": message}
