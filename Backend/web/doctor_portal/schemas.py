from datetime import date, time

from pydantic import BaseModel, Field, model_validator


class DoctorAppointmentOutSchema(BaseModel):
    """An appointment as seen by the treating doctor — includes the patient's
    triage intelligence collected by the AI intake."""
    id: int
    status: str
    reason: str | None
    severity_score: int
    slot_date: date | None = None
    slot_time: time | None = None
    duration_minutes: int | None = None
    patient_name: str | None = None
    patient_gender: str | None = None
    patient_phone: str | None = None
    patient_medical_history: str | None = None

    model_config = {"from_attributes": True}


class OutcomeUpdateSchema(BaseModel):
    status: str = Field(..., pattern="^(COMPLETED|NO_SHOW)$")


class PasswordChangeSchema(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)


class DoctorSlotCreateSchema(BaseModel):
    date: date
    start_time: time
    duration_minutes: int = Field(default=30, ge=5, le=240)
    closes_before_minutes: int = Field(default=15, ge=0)


class BulkSlotCreateSchema(BaseModel):
    """Generate recurring slots over a date range, e.g. 'every weekday 9:00-17:00,
    30-minute slots, for the next two weeks'."""
    start_date: date
    end_date: date
    start_time: time
    end_time: time
    duration_minutes: int = Field(default=30, ge=5, le=240)
    closes_before_minutes: int = Field(default=15, ge=0)
    # ISO weekday numbers to include: 1=Monday … 7=Sunday. Default: Mon-Fri.
    weekdays: list[int] = Field(default=[1, 2, 3, 4, 5])

    @model_validator(mode="after")
    def validate_range(self):
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        if (self.end_date - self.start_date).days > 90:
            raise ValueError("Date range cannot exceed 90 days")
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        if any(d < 1 or d > 7 for d in self.weekdays) or not self.weekdays:
            raise ValueError("weekdays must be ISO numbers 1 (Mon) through 7 (Sun)")
        return self


class BulkSlotResultSchema(BaseModel):
    created: int
    skipped_existing: int


class BriefingOutSchema(BaseModel):
    date: date
    total_appointments: int
    critical_count: int       # severity 4-5
    moderate_count: int       # severity 3
    routine_count: int        # severity 1-2
    first_appointment_time: time | None = None
    summary: str              # AI morning briefing (or deterministic fallback)


class DoctorAnalyticsOutSchema(BaseModel):
    """Practice insights over a trailing window. Trustworthy because visit
    outcomes are doctor-recorded, not patient-claimed."""
    window_days: int
    total_appointments: int
    completed: int
    no_show: int
    cancelled: int
    scheduled: int
    # no_show / (completed + no_show), as a percentage; None until outcomes exist
    no_show_rate: float | None = None
    avg_severity: float | None = None
    severity_counts: dict[int, int]
    busiest_weekday: str | None = None


class DoctorRescheduleOutSchema(BaseModel):
    id: int
    status: str
    severity_score: int | None = None
    proposed_slot_date: date | None = None
    proposed_slot_time: time | None = None
    target_slot_date: date | None = None
    target_slot_time: time | None = None

    model_config = {"from_attributes": True}
