from sqlalchemy import Column, Integer, String, Text

from database.db import Base
from models.mixins import TimestampMixin


class AuditLog(Base, TimestampMixin):
    """Durable record of sensitive / destructive backend actions.

    Append-only by convention: rows are never updated or deleted. Stores WHO
    did WHAT to WHICH object, plus a small JSON detail blob. Never stores
    secrets or full PII - only identifiers and non-sensitive context.
    """

    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    actor_role = Column(String(10), nullable=False)   # patient | doctor | admin | system
    actor_id = Column(Integer, nullable=True, index=True)
    action = Column(String(50), nullable=False, index=True)  # e.g. appointment.cancel
    target_type = Column(String(40), nullable=True)   # e.g. appointment, doctor, slot
    target_id = Column(Integer, nullable=True)
    detail = Column(Text, nullable=True)              # small JSON string
    ip_address = Column(String(45), nullable=True)    # IPv4/IPv6
