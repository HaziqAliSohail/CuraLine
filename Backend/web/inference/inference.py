from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger

from models.patient import Patient
from web.auth.security import get_current_patient
from web.auth.ratelimit import rate_limit
from web.inference.schemas import (
    InferenceInSchema,
    InferenceJobSchema,
    InferenceOutSchema,
    InferenceResultSchema,
)
from tasks.chat_tasks import chat_execution_task

inference_router = APIRouter()

# Each turn fans out to paid LLM calls, so cap submissions per client. Generous
# enough for natural back-and-forth (~1 turn/2s) but blocks cost/DoS abuse.
# Only the POST is limited; result polling (GET) is deliberately exempt.
_inference_limit = rate_limit("inference", limit=30, window_seconds=60)


def _format_result(result: dict, fallback_collected: dict) -> dict:
    """Map the task's raw output dict onto the public result shape."""
    return {
        "message": result.get("reply", ""),
        "is_appointment_booked": result.get("is_booked", False),
        "appointment_id": result.get("appointment_id"),
        "severity_score": result.get("severity_score"),
        "stage": result.get("stage"),
        "collected_fields": result.get("collected", fallback_collected),
        "urgent_guidance": result.get("urgent_guidance"),
        "guidance_type": result.get("guidance_type"),
    }


@inference_router.post("/", response_model=InferenceJobSchema, status_code=status.HTTP_202_ACCEPTED, dependencies=[Depends(_inference_limit)])
def start_inference(
    message_body: InferenceInSchema,
    current_patient: Patient = Depends(get_current_patient),
):
    """Submit a chat turn. Heavy LLM work runs on a Celery worker so the web
    process never blocks (and never pins a DB connection) on the LLM call.

    Returns a job_id to poll. If the broker is unreachable (local dev without
    a worker), the task is run inline and the result is returned immediately
    with status='complete'."""
    # Triage is gated on accepting the current medical disclaimer (enforced
    # server-side, not just in the UI).
    from web.consent.router import require_consent
    require_consent(current_patient)

    if not message_body.message or not message_body.message.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Message cannot be empty.",
        )

    history = message_body.conversation_history + [
        {"role": "user", "content": message_body.message.strip()}
    ]

    try:
        async_result = chat_execution_task.delay(
            patient_id=current_patient.id,
            conversation_history=history,
            collected_fields=message_body.collected_fields,
        )
        return {"job_id": async_result.id, "status": "pending", "result": None}
    except Exception as exc:
        # Broker down (e.g. dev without a worker) - degrade to inline execution
        # rather than failing the chat entirely.
        logger.warning(f"Chat task dispatch failed, running inline: {exc}")
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
            "job_id": None,
            "status": "complete",
            "result": _format_result(result, message_body.collected_fields),
        }


@inference_router.get("/result/{job_id}", response_model=InferenceResultSchema)
def get_inference_result(
    job_id: str,
    current_patient: Patient = Depends(get_current_patient),
):
    """Poll for a chat turn's result. Job IDs are unguessable UUID4 task ids."""
    from celery.result import AsyncResult
    from tasks.celery import celery

    res = AsyncResult(job_id, app=celery)

    if not res.ready():
        return {"status": "pending", "result": None}

    # Defence-in-depth: verify the requesting patient owns this job. Task ids
    # are unguessable UUID4s, but we still refuse to return another patient's
    # chat result. kwargs are available because result_extended=True; if absent
    # (older result), fall through - the id itself is the access control.
    try:
        owner_id = (res.kwargs or {}).get("patient_id")
    except Exception:
        owner_id = None
    if owner_id is not None and owner_id != current_patient.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Result not found.")

    if res.failed():
        logger.error(f"Chat job {job_id} failed: {res.result}")
        return {
            "status": "complete",
            "result": _format_result(
                {"reply": "I'm having trouble right now. Please try again.", "is_booked": False},
                {},
            ),
        }

    result = res.result
    if not isinstance(result, dict):
        return {
            "status": "complete",
            "result": _format_result({"reply": "AI service unavailable. Please try again."}, {}),
        }
    return {"status": "complete", "result": _format_result(result, {})}
