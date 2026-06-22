"""Audit logging helper - records sensitive/destructive actions durably.

Fails safe: an audit-write failure must never break the user action it
describes, so write errors are swallowed and logged. Never pass secrets or
full PII into `detail`.
"""
import json

from fastapi import Request
from loguru import logger
from sqlalchemy.orm import Session

from models.audit_log import AuditLog


def client_ip(request: Request | None) -> str | None:
    """Best-effort client IP, honouring the first X-Forwarded-For hop."""
    if request is None:
        return None
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else None


def record_audit(
    db: Session,
    *,
    actor_role: str,
    actor_id: int | None,
    action: str,
    target_type: str | None = None,
    target_id: int | None = None,
    detail: dict | None = None,
    ip_address: str | None = None,
) -> None:
    try:
        db.add(AuditLog(
            actor_role=actor_role,
            actor_id=actor_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            detail=json.dumps(detail) if detail else None,
            ip_address=ip_address,
        ))
        db.flush()
    except Exception as exc:  # never let auditing break the real action
        logger.error(f"Audit write failed for {action}: {exc}")
