from fastapi import APIRouter

from .inference.inference import inference_router

web_router = APIRouter()
web_router.include_router(inference_router, prefix="/inference", tags=["Inference Routes"])


