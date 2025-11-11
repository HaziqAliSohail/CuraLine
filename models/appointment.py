from sqlalchemy import Column, Integer, Date, Time, Enum, Text
from sqlalchemy.orm import Relationship

from database.db import Base
from models.mixins import TimestampMixin


class Appointment(Base, TimestampMixin):
    # Statuses
    SCHEDULED = "SCHEDULED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    NO_SHOW = "NO_SHOW"
    STATUSES = [SCHEDULED, COMPLETED, CANCELLED, NO_SHOW]

    __tablename__ = "appointment"

    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(Integer)
    doctor_id = Column(Integer)
    appointment_date = Column(Date)
    appointment_time = Column(Time)
    status = Column(Enum(*STATUSES), default=SCHEDULED)
    reason = Column(Text)

    patient_details = Relationship()
    doctor_details = Relationship()

