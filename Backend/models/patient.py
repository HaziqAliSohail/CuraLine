from sqlalchemy import Column, String, Integer, Text, Date, Boolean, DateTime
from sqlalchemy.orm import relationship

from database.db import Base
from models.encrypted import EncryptedText
from models.mixins import PersonalDataMixin, TimestampMixin


class Patient(Base, PersonalDataMixin, TimestampMixin):

    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, autoincrement=True)
    password_hash = Column(String(255), nullable=False)
    medical_history = Column(EncryptedText)  # PHI — encrypted at rest
    last_visit_date = Column(Date)
    is_admin = Column(Boolean, default=False, nullable=False)
    # US insurance details — plan/carrier name plus the identifiers a real-time
    # eligibility check (X12 270/271) needs.
    insurance_plan = Column(String(100), nullable=True)
    insurance_member_id = Column(String(50), nullable=True)
    insurance_group_number = Column(String(50), nullable=True)
    # Medical-disclaimer / consent acceptance. Triage is gated on the patient
    # having accepted the CURRENT consent version (see web/consent).
    consent_version = Column(String(20), nullable=True)
    consent_accepted_at = Column(DateTime(timezone=True), nullable=True)
    # Opt-in: may this patient be ASKED to give up their slot for a more urgent
    # patient? Default off — a patient is never targeted by a severity swap unless
    # they've explicitly consented. (They still confirm each swap when asked.)
    allow_severity_swap = Column(Boolean, default=False, nullable=False)
    # Email verification + password reset (tokens stored hashed, single-use).
    email_verified = Column(Boolean, default=False, nullable=False)
    verification_token_hash = Column(String(64), nullable=True)
    verification_expires_at = Column(DateTime(timezone=True), nullable=True)
    reset_token_hash = Column(String(64), nullable=True)
    reset_expires_at = Column(DateTime(timezone=True), nullable=True)

    appointments = relationship("Appointment", back_populates="patient", lazy="select")
