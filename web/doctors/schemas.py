from datetime import time
from decimal import Decimal

from pydantic import BaseModel, Field


class DoctorInSchema(BaseModel):
    name: str = Field(..., max_length=50)
    gender: str = Field(..., pattern="^(MALE|FEMALE|OTHER)$")
    phone: str | None = Field(None, max_length=15)
    email: str | None = None
    specialization: str = Field(..., max_length=100)
    qualification: str = Field(..., max_length=100)
    availability_status: str = Field(default="AVAILABLE", pattern="^(AVAILABLE|LEAVE|OFFLINE)$")
    consultation_fee: Decimal = Field(..., ge=0)
    reporting_time: time
    leaving_time: time


class DoctorOutSchema(BaseModel):
    id: int
    name: str
    gender: str
    phone: str | None
    email: str | None
    specialization: str
    qualification: str
    availability_status: str
    consultation_fee: Decimal
    reporting_time: time
    leaving_time: time
    rating: int

    model_config = {"from_attributes": True}
