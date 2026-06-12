import json
from datetime import time
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator


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
    # Optional portal login password — set by admin when provisioning access.
    # Omit (or null) to create a doctor without portal access.
    password: str | None = Field(default=None, min_length=8)
    accepted_insurance_plans: list[str] = Field(default_factory=list)


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
    accepted_insurance_plans: list[str] = []

    @field_validator("accepted_insurance_plans", mode="before")
    @classmethod
    def _deserialize_plans(cls, v):
        """The DB column stores a JSON string; convert to list for the API."""
        if v is None:
            return []
        if isinstance(v, str):
            try:
                return json.loads(v)
            except (json.JSONDecodeError, TypeError):
                return []
        return v

    model_config = {"from_attributes": True}


class DoctorApplicationOutSchema(DoctorOutSchema):
    """Admin view of a doctor application — includes credential fields."""
    application_status: str
    license_number: str | None = None


class ApplicationDecisionSchema(BaseModel):
    action: str = Field(..., pattern="^(approve|reject)$")
