from datetime import datetime

from pydantic import BaseModel, Field


class ReviewCreateSchema(BaseModel):
    appointment_id: int
    rating: int = Field(..., ge=1, le=5)
    comment: str | None = Field(default=None, max_length=1000)


class ReviewOutSchema(BaseModel):
    id: int
    rating: int
    comment: str | None
    # Abbreviated for privacy, e.g. "John C."
    patient_display_name: str
    created_at: datetime | None = None
    # Always true by construction - reviews require a doctor-recorded
    # COMPLETED visit. Kept explicit so clients can badge it.
    verified: bool = True

    model_config = {"from_attributes": True}


class DoctorReviewsOutSchema(BaseModel):
    doctor_id: int
    average_rating: float
    review_count: int
    reviews: list[ReviewOutSchema]


class MyReviewOutSchema(BaseModel):
    id: int
    appointment_id: int
    doctor_id: int
    rating: int
    comment: str | None

    model_config = {"from_attributes": True}
