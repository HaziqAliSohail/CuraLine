from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Enum, String


class PersonalDataMixin:

    # Genders
    MALE = "MALE"
    FEMALE = "FEMALE"
    OTHER = "OTHER"
    GENDERS = [MALE, FEMALE, OTHER]

    name = Column(String(50), nullable=False, index=True)
    gender = Column(Enum(*GENDERS, name="gender_enum"), nullable=False)
    phone = Column(String(15))
    email = Column(String(50), nullable=True)


class TimestampMixin:
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
