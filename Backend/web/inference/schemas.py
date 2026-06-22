from pydantic import BaseModel, Field, field_validator

# Hard limits to bound LLM token spend per request (cost-abuse protection)
MAX_MESSAGE_CHARS = 2000
MAX_HISTORY_TURNS = 60
MAX_TURN_CHARS = 4000


class InferenceInSchema(BaseModel):
    message: str = Field(
        default="",
        max_length=MAX_MESSAGE_CHARS,
        description="The patient's chat message",
        examples=["I have severe chest pain radiating to my arm for the past 2 hours"]
    )
    conversation_history: list = Field(
        default=[],
        max_length=MAX_HISTORY_TURNS,
        description="Prior turns in the conversation as list of {role, content} dicts",
    )
    collected_fields: dict = Field(
        default={},
        description="Fields already collected in previous turns",
    )

    @field_validator("conversation_history")
    @classmethod
    def validate_history_turns(cls, turns: list) -> list:
        for turn in turns:
            if not isinstance(turn, dict):
                raise ValueError("Each conversation turn must be an object with role and content.")
            if turn.get("role") not in ("user", "assistant"):
                raise ValueError("Conversation turn role must be 'user' or 'assistant'.")
            content = turn.get("content", "")
            if not isinstance(content, str) or len(content) > MAX_TURN_CHARS:
                raise ValueError(f"Conversation turn content must be a string under {MAX_TURN_CHARS} characters.")
        return turns


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
    urgent_guidance: str | None = Field(
        default=None,
        description="Actionable urgent care guidance matched from the knowledge base",
    )
    guidance_type: str | None = Field(
        default=None,
        description="Guidance category: EMERGENCY, URGENT_CARE, TELEHEALTH, FIRST_AID, or null",
    )


class InferenceJobSchema(BaseModel):
    """Returned immediately when a chat turn is submitted. The heavy LLM work
    runs in the background; clients poll /inference/result/{job_id}.

    When no worker/broker is reachable (e.g. local dev), the server runs the
    task inline and returns status='complete' with the result already filled,
    so clients need no special-casing."""
    job_id: str | None = Field(default=None, description="Poll token; null when run inline")
    status: str = Field(description="pending | complete")
    result: InferenceOutSchema | None = Field(default=None)


class InferenceResultSchema(BaseModel):
    status: str = Field(description="pending | complete | error")
    result: InferenceOutSchema | None = Field(default=None)
