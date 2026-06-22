from sqlalchemy import Column, Float, Integer, String
from sqlalchemy.orm import relationship

from database.db import Base
from models.mixins import TimestampMixin


class Hospital(Base, TimestampMixin):
    """A hospital / clinic site. Foundation for multi-tenant deployments:
    doctors belong to a hospital, and patient search can scope to one."""

    __tablename__ = "hospitals"

    # Verification (KYB): the platform operator is the root of trust and must
    # verify a hospital before its admin can approve doctors. Default VERIFIED so
    # seeded/existing rows keep working; self-serve applications start PENDING.
    PENDING = "PENDING"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"
    VERIFICATION_STATUSES = [PENDING, VERIFIED, REJECTED]

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, index=True)
    address = Column(String(255), nullable=True)
    phone = Column(String(15), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    verification_status = Column(String(20), default="VERIFIED", nullable=False)
    org_npi = Column(String(10), nullable=True)  # NPI Type 2 (organizational)

    doctors = relationship("Doctor", back_populates="hospital")
