from sqlalchemy import Column, Integer, Enum, ForeignKey
from sqlalchemy.orm import relationship

from database.db import Base
from models.mixins import TimestampMixin


class RescheduleRequest(Base, TimestampMixin):

    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    DECLINED = "DECLINED"
    STATUSES = [PENDING, ACCEPTED, DECLINED]

    __tablename__ = "reschedule_requests"

    id = Column(Integer, primary_key=True, autoincrement=True)
    triggering_appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=False)
    target_appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=False)
    proposed_slot_id = Column(Integer, ForeignKey("doctor_slots.id"), nullable=False)
    status = Column(Enum(*STATUSES, name="reschedule_status_enum"), default=PENDING)

    triggering_appointment = relationship(
        "Appointment",
        foreign_keys=[triggering_appointment_id],
        back_populates="reschedule_requests_sent",
    )
    target_appointment = relationship(
        "Appointment",
        foreign_keys=[target_appointment_id],
        back_populates="reschedule_requests_received",
    )
    proposed_slot = relationship("DoctorSlot")
