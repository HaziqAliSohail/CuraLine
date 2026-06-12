from sqlalchemy import Column, Integer, Enum, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship

from database.db import Base
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
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    slot_id = Column(Integer, ForeignKey("doctor_slots.id"), nullable=False)
    status = Column(Enum(*STATUSES, name="appointment_status_enum"), default=SCHEDULED)
    reason = Column(Text)
    severity_score = Column(Integer, default=1)
    reschedule_requested = Column(Boolean, default=False)
    # Set once the day-before reminder email has gone out (idempotency flag)
    reminder_sent = Column(Boolean, default=False, nullable=False)

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

