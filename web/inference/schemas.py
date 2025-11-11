from pydantic import BaseModel, Field


class InferenceInSchema(BaseModel):
    message: str = Field(
        default="",
        description="The message of the chat",
        examples=["Hi! How are you?", "Please book an appointment for me"]
    )


class InferenceOutSchema(BaseModel):
    message: str = Field(
        default="",
        description="The message of the chat",
        examples=["Hi! How are you?", "Please book an appointment for me"]
    )
    ís_appointment_booked: bool = Field(
        default=False,
        description="The boolean to state that appointment is booked",
        examples=[False]
    )
