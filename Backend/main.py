import sys

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from loguru import logger

from settings import settings
from web import web_router

# Validate production safety at startup (no-op in tests)
settings.validate_production_settings()

# Error monitoring — only active when SENTRY_DSN is set. send_default_pii=False
# is critical: never let symptom text / patient data into error reports.
if settings.sentry_dsn:
    import sentry_sdk
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        traces_sample_rate=0.1,
        send_default_pii=False,
    )

# Configure logging so exception tracebacks never dump local variable values
# (which can contain PII/PHI). diagnose is opt-in for local debugging only.
logger.remove()
logger.add(
    sys.stderr,
    level="INFO",
    backtrace=False,
    diagnose=settings.log_diagnose,
)

# Interactive docs are opt-in (ENABLE_DOCS=true) so production doesn't publish
# the full API surface by default.
_docs_enabled = settings.enable_docs
app = FastAPI(
    title="CuraLine - Smart Hospital Registration",
    version="1.0.0",
    description="AI-powered hospital appointment system with severity-based smart scheduling.",
    docs_url="/docs" if _docs_enabled else None,
    redoc_url="/redoc" if _docs_enabled else None,
    openapi_url="/openapi.json" if _docs_enabled else None,
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
    # Log the path only - query strings can carry PII (e.g. nearby-hospital geo)
    logger.error(f"Database error on {request.method} {request.url.path}: {exc}")
    return JSONResponse(status_code=500, content={"detail": "A database error occurred."})


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.method} {request.url.path}: {exc}")
    return JSONResponse(status_code=500, content={"detail": "An internal server error occurred."})
