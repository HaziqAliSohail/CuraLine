from sqlalchemy import Column, Enum, Integer, String, Time

from database.db import Base
from models.mixins import PersonalDataMixin, TimestampMixin


class Doctor(Base, PersonalDataMixin, TimestampMixin):

    # Availability Statuses
    AVAILABLE = "AVAILABLE"
    LEAVE = "LEAVE"
    OFFLINE = "OFFLINE"
    AVAILABILITY_STATUSES = [AVAILABLE, LEAVE, OFFLINE]

    __tablename__ = "doctors"

    id = Column(Integer, primary_key=True, autoincrement=True)
    specialization = Column(String(100), nullable=False)
    qualification = Column(String(100), nullable=False)
    availability_status = Column(Enum(*AVAILABILITY_STATUSES), default=AVAILABLE)
    consultation_fee = Column(Integer(5), nullable=False)
    reporting_time = Column(Time, nullable=False)
    leaving_time = Column(Time, nullable=False)
    rating = Column(Integer, default=5)

