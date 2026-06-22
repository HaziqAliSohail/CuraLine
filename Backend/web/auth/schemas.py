from pydantic import BaseModel, EmailStr, Field


class RegisterInSchema(BaseModel):
    name: str = Field(..., max_length=50)
    gender: str = Field(..., pattern="^(MALE|FEMALE|OTHER)$")
    phone: str = Field(None, max_length=15)
    email: EmailStr
    password: str = Field(..., min_length=8)
    medical_history: str = Field(default="")
    insurance_plan: str | None = Field(default=None, max_length=100)


class LoginInSchema(BaseModel):
    email: EmailStr
    password: str


class DoctorApplyInSchema(BaseModel):
    """Self-serve doctor application - account stays PENDING until an admin
    verifies the credentials and approves it."""
    name: str = Field(..., max_length=50)
    gender: str = Field(..., pattern="^(MALE|FEMALE|OTHER)$")
    phone: str | None = Field(None, max_length=15)
    email: EmailStr
    password: str = Field(..., min_length=8)
    specialization: str = Field(..., max_length=100)
    qualification: str = Field(..., max_length=100)
    license_number: str = Field(..., min_length=3, max_length=50)
    # US National Provider Identifier - optional, enables automated verification
    npi_number: str | None = Field(default=None, pattern=r"^\d{10}$")
    # Hospital the doctor is applying to (None = independent → platform approves)
    hospital_id: int | None = Field(default=None)


class HospitalApplyInSchema(BaseModel):
    """Self-serve hospital/clinic onboarding. Creates a PENDING hospital plus a
    hospital-admin account; the platform operator verifies before it goes live."""
    hospital_name: str = Field(..., max_length=100)
    org_npi: str | None = Field(default=None, pattern=r"^\d{10}$")
    address: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=15)
    admin_name: str = Field(..., max_length=50)
    admin_email: EmailStr
    admin_password: str = Field(..., min_length=8)


class InviteInfoOutSchema(BaseModel):
    name: str
    email: str
    specialization: str

    model_config = {"from_attributes": True}


class InviteAcceptInSchema(BaseModel):
    password: str = Field(..., min_length=8)


class DoctorApplyOutSchema(BaseModel):
    id: int
    name: str
    email: str
    specialization: str
    application_status: str

    model_config = {"from_attributes": True}


class TokenOutSchema(BaseModel):
    access_token: str
    refresh_token: str | None = None
    token_type: str = "bearer"


class RefreshInSchema(BaseModel):
    refresh_token: str


class VerifyEmailInSchema(BaseModel):
    token: str


class ForgotPasswordInSchema(BaseModel):
    email: EmailStr


class ResetPasswordInSchema(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)


class PatientOutSchema(BaseModel):
    id: int
    name: str
    gender: str
    email: str
    phone: str | None
    medical_history: str | None
    is_admin: bool = False
    email_verified: bool = False
    allow_severity_swap: bool = False
    insurance_plan: str | None = None
    insurance_member_id: str | None = None
    insurance_group_number: str | None = None

    model_config = {"from_attributes": True}
