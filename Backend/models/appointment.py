from sqlalchemy import Column, Integer, Enum, Text, Boolean, ForeignKey, Float, String
from sqlalchemy.orm import relationship

from database.db import Base
from models.encrypted import EncryptedText
from models.mixins import TimestampMixin


class Appointment(Base, TimestampMixin):
    # Statuses
    SCHEDULED = "SCHEDULED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    NO_SHOW = "NO_SHOW"
    STATUSES = [SCHEDULED, COMPLETED, CANCELLED, NO_SHOW]

    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False, index=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False, index=True)
    slot_id = Column(Integer, ForeignKey("doctor_slots.id"), nullable=False, index=True)
    status = Column(Enum(*STATUSES, name="appointment_status_enum"), default=SCHEDULED, index=True)
    reason = Column(EncryptedText)  # PHI — encrypted at rest
    severity_score = Column(Integer, default=1)
    reschedule_requested = Column(Boolean, default=False)
    # Set once the day-before reminder email has gone out (idempotency flag)
    reminder_sent = Column(Boolean, default=False, nullable=False)
    clinical_summary = Column(EncryptedText, nullable=True)  # PHI
    no_show_probability = Column(Float, nullable=True)
    no_show_risk_reason = Column(EncryptedText, nullable=True)  # PHI
    conversation_history = Column(EncryptedText, nullable=True)  # PHI (full transcript)
    # Telehealth video room URL (created lazily via the Daily.co adapter).
    video_room_url = Column(String(255), nullable=True)

    patient = relationship("Patient", back_populates="appointments")
    doctor = relationship("Doctor")
    slot = relationship("DoctorSlot", back_populates="appointments")
    reschedule_requests_sent = relationship(
        "RescheduleRequest",
        foreign_keys="RescheduleRequest.triggering_appointment_id",
        back_populates="triggering_appointment",
    )
    reschedule_requests_received = relationship(
        "RescheduleRequest",
        foreign_keys="RescheduleRequest.target_appointment_id",
        back_populates="target_appointment",
    )

