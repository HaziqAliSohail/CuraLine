from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, String


class PersonalDataMixin:

    # Genders
    MALE = "MALE"
    FEMALE = "FEMALE"
    OTHER = "OTHER"
    GENDERS = [MALE, FEMALE, OTHER]

    name = Column(String(50), nullable=False, index=True)
    gender = Column(Enum(*GENDERS), nullable=False)
    phone = Column(String(15))
    email = Column(String(50), nullable=True)


class TimestampMixin:
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
