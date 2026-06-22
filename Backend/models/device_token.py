from sqlalchemy import Column, Integer, String

from database.db import Base
from models.mixins import TimestampMixin


class DeviceToken(Base, TimestampMixin):
    """A mobile device registered for push notifications (Expo push token).

    One row per device; a subject (patient or doctor) may have several devices.
    """

    __tablename__ = "device_tokens"

    id = Column(Integer, primary_key=True, autoincrement=True)
    subject_id = Column(Integer, nullable=False, index=True)
    role = Column(String(10), nullable=False)  # patient | doctor
    expo_push_token = Column(String(200), nullable=False, unique=True)
