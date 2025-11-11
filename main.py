from fastapi import FastAPI
import uvicorn

from web import web_router

app = FastAPI(title="Smart Hospital Registration")

app.include_router(web_router, prefix="/v1")

app.setup()

