from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from loguru import logger

from settings import settings
from web import web_router

# Validate production safety at startup (no-op in tests)
settings.validate_production_settings()

app = FastAPI(
    title="CuraLine — Smart Hospital Registration",
    version="1.0.0",
    description="AI-powered hospital appointment system with severity-based smart scheduling.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(web_router, prefix="/v1")


@app.get("/health", tags=["Health"])
def health_check():
    """Load-balancer / readiness health check: verifies DB and Redis connectivity."""
    from sqlalchemy import text
    from database.db import engine

    checks = {"api": "ok"}
    healthy = True

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as exc:
        logger.error(f"Health check: database unreachable: {exc}")
        checks["database"] = "unreachable"
        healthy = False

    try:
        import redis
        r = redis.Redis.from_url(settings.redis_url, socket_connect_timeout=2)
        r.ping()
        checks["redis"] = "ok"
    except Exception as exc:
        logger.warning(f"Health check: redis unreachable: {exc}")
        checks["redis"] = "unreachable"
        # Redis degrades background tasks but does not take the API down

    status_code = 200 if healthy else 503
    return JSONResponse(
        status_code=status_code,
        content={"status": "ok" if healthy else "degraded", "version": "1.0.0", "checks": checks},
    )


@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    logger.error(f"Database error on {request.method} {request.url}: {exc}")
    return JSONResponse(status_code=500, content={"detail": "A database error occurred."})


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.method} {request.url}: {exc}", exc_info=True)
    return JSONResponse(status_code=500, content={"detail": "An internal server error occurred."})
