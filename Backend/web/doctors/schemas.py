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
    # Optional portal login password - set by admin when provisioning access.
    # Omit (or null) to create a doctor without portal access.
    password: str | None = Field(default=None, min_length=8)
    accepted_insurance_plans: list[str] = Field(default_factory=list)


class DoctorPublicOutSchema(BaseModel):
    """Patient-facing doctor view. Deliberately excludes the doctor's personal
    contact details (email/phone) so the public listing can't be scraped for
    PII - patients book via slots, not by contacting doctors directly."""
    id: int
    name: str
    gender: str
    specialization: str
    qualification: str
    availability_status: str
    consultation_fee: Decimal
    reporting_time: time
    leaving_time: time
    rating: int
    accepted_insurance_plans: list[str] = []
    hospital_id: int | None = None
    hospital_name: str | None = None
    latitude: float | None = None
    longitude: float | None = None

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


class DoctorOutSchema(DoctorPublicOutSchema):
    """Full view including contact details - used for a doctor's OWN profile
    (/doctor/me) and admin create/update responses, never the public listing."""
    phone: str | None = None
    email: str | None = None
    is_hospital_admin: bool = False


class DoctorApplicationOutSchema(DoctorOutSchema):
    """Admin view of a doctor application - includes credential fields."""
    application_status: str
    license_number: str | None = None
    npi_number: str | None = None
    npi_verification_status: str = "UNVERIFIED"


class NpiVerificationOutSchema(BaseModel):
    doctor_id: int
    npi_number: str
    status: str  # VERIFIED | MISMATCH | NOT_FOUND | ERROR
    registry_name: str | None = None
    taxonomy: str | None = None


class ApplicationDecisionSchema(BaseModel):
    action: str = Field(..., pattern="^(approve|reject)$")


class DoctorInviteInSchema(BaseModel):
    """Admin-initiated onboarding: the doctor sets their own password via a
    one-time emailed link, so the admin never knows their credentials."""
    name: str = Field(..., max_length=50)
    gender: str = Field(..., pattern="^(MALE|FEMALE|OTHER)$")
    phone: str | None = Field(None, max_length=15)
    email: str = Field(..., max_length=50)
    specialization: str = Field(..., max_length=100)
    qualification: str = Field(..., max_length=100)


class DoctorInviteOutSchema(BaseModel):
    id: int
    name: str
    email: str
    # Returned so the admin can copy/share the link manually when SMTP is
    # not configured (dev) or the email goes astray.
    invite_link: str
    expires_in_days: int
