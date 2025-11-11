from datetime import date

from sqlalchemy import Column, String, Integer, Text, Date, Enum

from database.db import Base
from models.mixins import PersonalDataMixin, TimestampMixin


class Patient(Base, PersonalDataMixin, TimestampMixin):

    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, autoincrement=True)
    medical_history = Column(Text)
    last_visit_date = Column(Date, default=date.today())



