from sqlalchemy import Column, String, Integer, Text, Date, Boolean
from sqlalchemy.orm import relationship

from database.db import Base
from models.mixins import PersonalDataMixin, TimestampMixin


class Patient(Base, PersonalDataMixin, TimestampMixin):

    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, autoincrement=True)
    password_hash = Column(String(255), nullable=False)
    medical_history = Column(Text)
    last_visit_date = Column(Date)
    is_admin = Column(Boolean, default=False, nullable=False)
    insurance_plan = Column(String(100), nullable=True)

    appointments = relationship("Appointment", back_populates="patient", lazy="select")
