from datetime import date, time

from pydantic import BaseModel, Field


class AppointmentOutSchema(BaseModel):
    id: int
    patient_id: int
    doctor_id: int
    slot_id: int
    status: str
    reason: str | None
    severity_score: int
    reschedule_requested: bool
    slot_date: date | None = None
    slot_time: time | None = None
    doctor_name: str | None = None

    model_config = {"from_attributes": True}


class AppointmentStatusUpdateSchema(BaseModel):
    status: str = Field(..., pattern="^(COMPLETED|NO_SHOW|CANCELLED)$")
