from pydantic import BaseModel, Field


class InferenceInSchema(BaseModel):
    message: str = Field(
        default="",
        description="The patient's chat message",
        examples=["I have severe chest pain radiating to my arm for the past 2 hours"]
    )
    conversation_history: list = Field(
        default=[],
        description="Prior turns in the conversation as list of {role, content} dicts",
    )
    collected_fields: dict = Field(
        default={},
        description="Fields already collected in previous turns",
    )


class InferenceOutSchema(BaseModel):
    message: str = Field(
        default="",
        description="The assistant's reply to the patient",
    )
    is_appointment_booked: bool = Field(
        default=False,
        description="True when the appointment has been successfully booked",
    )
    appointment_id: int | None = Field(default=None)
    severity_score: int | None = Field(default=None)
    stage: str | None = Field(default=None, description="Current flow stage: intake, complete, emergency, no_slots")
    collected_fields: dict = Field(default={})
