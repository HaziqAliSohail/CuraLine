from datetime import date, time

from pydantic import BaseModel


class RescheduleRequestOutSchema(BaseModel):
    id: int
    triggering_appointment_id: int
    target_appointment_id: int
    proposed_slot_id: int
    status: str
    proposed_slot_date: date | None = None
    proposed_slot_time: time | None = None
    current_slot_date: date | None = None
    current_slot_time: time | None = None

    model_config = {"from_attributes": True}
