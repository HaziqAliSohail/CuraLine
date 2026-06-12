from fastapi import APIRouter, Depends, HTTPException, status

from models.patient import Patient
from web.auth.security import get_current_patient
from web.inference.schemas import InferenceInSchema, InferenceOutSchema
from tasks.chat_tasks import chat_execution_task

inference_router = APIRouter()


@inference_router.post("/", response_model=InferenceOutSchema)
def inference(
    message_body: InferenceInSchema,
    current_patient: Patient = Depends(get_current_patient),
):
    # Reject blank or whitespace-only messages to avoid wasting LLM tokens
    if not message_body.message or not message_body.message.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Message cannot be empty.",
        )

    history = message_body.conversation_history + [
        {"role": "user", "content": message_body.message.strip()}
    ]

    result = chat_execution_task(
        patient_id=current_patient.id,
        conversation_history=history,
        collected_fields=message_body.collected_fields,
    )

    if not isinstance(result, dict):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service unavailable. Please try again.",
        )

    return {
        "message": result.get("reply", ""),
        "is_appointment_booked": result.get("is_booked", False),
        "appointment_id": result.get("appointment_id"),
        "severity_score": result.get("severity_score"),
        "stage": result.get("stage"),
        "collected_fields": result.get("collected", message_body.collected_fields),
        "urgent_guidance": result.get("urgent_guidance"),
        "guidance_type": result.get("guidance_type"),
    }
