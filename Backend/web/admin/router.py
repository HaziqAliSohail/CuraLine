"""Admin-only operational views. Gated on require_admin (is_admin patient = the
platform operator / root of trust)."""
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database.db import get_db_session
from models.audit_log import AuditLog
from models.hospital import Hospital
from web.audit import client_ip, record_audit
from web.auth.permissions import require_admin

admin_router = APIRouter()


@admin_router.get("/me")
def get_my_admin_profile(admin=Depends(require_admin)):
    """The signed-in platform operator's own profile."""
    return {"id": admin.id, "name": admin.name, "email": admin.email, "role": "admin"}


class HospitalDecisionSchema(BaseModel):
    action: str = Field(..., pattern="^(approve|reject)$")


def _hospital_out(h: Hospital) -> dict:
    return {
        "id": h.id, "name": h.name, "address": h.address, "phone": h.phone,
        "org_npi": h.org_npi, "verification_status": h.verification_status,
    }


@admin_router.get("/hospitals")
def list_hospitals(
    verification_status: str | None = Query(default=None),
    _admin=Depends(require_admin),
    db: Session = Depends(get_db_session),
):
    """Platform operator: review hospital onboarding (defaults to all)."""
    q = db.query(Hospital)
    if verification_status:
        q = q.filter(Hospital.verification_status == verification_status)
    return [_hospital_out(h) for h in q.order_by(Hospital.id.desc()).all()]


@admin_router.put("/hospitals/{hospital_id}/verification")
def decide_hospital(
    hospital_id: int,
    body: HospitalDecisionSchema,
    request: Request,
    admin=Depends(require_admin),
    db: Session = Depends(get_db_session),
):
    """Platform operator verifies (or rejects) a hospital. Only a VERIFIED
    hospital's admin can approve that hospital's doctors."""
    hospital = db.query(Hospital).filter(Hospital.id == hospital_id).first()
    if not hospital:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hospital not found.")
    hospital.verification_status = Hospital.VERIFIED if body.action == "approve" else Hospital.REJECTED
    record_audit(
        db, actor_role="admin", actor_id=admin.id,
        action=f"hospital.{body.action}", target_type="hospital", target_id=hospital.id,
        ip_address=client_ip(request),
    )
    db.flush()
    return _hospital_out(hospital)


@admin_router.post("/hospitals/{hospital_id}/verify-npi")
def verify_hospital_npi(
    hospital_id: int,
    _admin=Depends(require_admin),
    db: Session = Depends(get_db_session),
):
    """Run a CMS org-NPI (Type 2) check to assist hospital verification."""
    hospital = db.query(Hospital).filter(Hospital.id == hospital_id).first()
    if not hospital:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hospital not found.")
    if not hospital.org_npi:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="This hospital has no organizational NPI on file.",
        )
    from clients import npi
    return npi.verify_org_npi(hospital.org_npi, hospital.name)


@admin_router.get("/audit-logs")
def list_audit_logs(
    action: str | None = Query(default=None),
    actor_role: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _admin=Depends(require_admin),
    db: Session = Depends(get_db_session),
):
    """Paginated, filterable view of the append-only audit trail (newest first)."""
    q = db.query(AuditLog)
    if action:
        q = q.filter(AuditLog.action == action)
    if actor_role:
        q = q.filter(AuditLog.actor_role == actor_role)
    total = q.count()
    rows = q.order_by(AuditLog.id.desc()).offset(offset).limit(limit).all()
    return {
        "total": total,
        "items": [
            {
                "id": r.id,
                "actor_role": r.actor_role,
                "actor_id": r.actor_id,
                "action": r.action,
                "target_type": r.target_type,
                "target_id": r.target_id,
                "detail": r.detail,
                "ip_address": r.ip_address,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
    }
