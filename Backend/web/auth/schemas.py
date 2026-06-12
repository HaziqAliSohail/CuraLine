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
    """Self-serve doctor application — account stays PENDING until an admin
    verifies the credentials and approves it."""
    name: str = Field(..., max_length=50)
    gender: str = Field(..., pattern="^(MALE|FEMALE|OTHER)$")
    phone: str | None = Field(None, max_length=15)
    email: EmailStr
    password: str = Field(..., min_length=8)
    specialization: str = Field(..., max_length=100)
    qualification: str = Field(..., max_length=100)
    license_number: str = Field(..., min_length=3, max_length=50)


class DoctorApplyOutSchema(BaseModel):
    id: int
    name: str
    email: str
    specialization: str
    application_status: str

    model_config = {"from_attributes": True}


class TokenOutSchema(BaseModel):
    access_token: str
    token_type: str = "bearer"


class PatientOutSchema(BaseModel):
    id: int
    name: str
    gender: str
    email: str
    phone: str | None
    medical_history: str | None
    is_admin: bool = False
    insurance_plan: str | None = None

    model_config = {"from_attributes": True}
