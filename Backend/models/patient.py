from sqlalchemy import Column, String, Integer, Text, Date
from sqlalchemy.orm import relationship

from database.db import Base
from models.mixins import PersonalDataMixin, TimestampMixin


class Patient(Base, PersonalDataMixin, TimestampMixin):

    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, autoincrement=True)
    password_hash = Column(String(255), nullable=False)
    medical_history = Column(Text)
    last_visit_date = Column(Date)

    appointments = relationship("Appointment", back_populates="patient", lazy="select")



