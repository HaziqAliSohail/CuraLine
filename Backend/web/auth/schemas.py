from pydantic import BaseModel, EmailStr, Field


class RegisterInSchema(BaseModel):
    name: str = Field(..., max_length=50)
    gender: str = Field(..., pattern="^(MALE|FEMALE|OTHER)$")
    phone: str = Field(None, max_length=15)
    email: EmailStr
    password: str = Field(..., min_length=8)
    medical_history: str = Field(default="")


class LoginInSchema(BaseModel):
    email: EmailStr
    password: str


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

    model_config = {"from_attributes": True}
