from sqlalchemy import Column, Integer, Date, Time, Boolean, ForeignKey
from sqlalchemy.orm import relationship

from database.db import Base
from models.mixins import TimestampMixin


class DoctorSlot(Base, TimestampMixin):

    __tablename__ = "doctor_slots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    start_time = Column(Time, nullable=False)
    duration_minutes = Column(Integer, nullable=False, default=30)
    closes_before_minutes = Column(Integer, nullable=False, default=15)
    is_available = Column(Boolean, default=True, index=True)

    doctor = relationship("Doctor")
    appointments = relationship("Appointment", back_populates="slot")
