from datetime import date, time

from pydantic import BaseModel, Field


class SlotInSchema(BaseModel):
    doctor_id: int
    date: date
    start_time: time
    duration_minutes: int = Field(default=30, ge=5)
    closes_before_minutes: int = Field(default=15, ge=0)


class SlotOutSchema(BaseModel):
    id: int
    doctor_id: int
    date: date
    start_time: time
    duration_minutes: int
    closes_before_minutes: int
    is_available: bool

    model_config = {"from_attributes": True}
