from fastapi import APIRouter

from clients import llm_client
from tasks.chat_tasks import chat_execution_task
from web.inference.schemas import InferenceInSchema, InferenceOutSchema

inference_router = APIRouter()


@inference_router.post("/", response_model=InferenceOutSchema)
def inference(message_body: InferenceInSchema):
    message = message_body.message
    response = llm_client.query(message=message)
    chat_execution_task.delay()
    return {
        "message": response
    }
