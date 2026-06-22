from sqlalchemy import Column, ForeignKey, Integer, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from database.db import Base
from models.mixins import TimestampMixin


class Review(Base, TimestampMixin):
    """A verified patient review.

    Integrity by construction: a review can only be created for an appointment
    the reviewer owns AND that the doctor marked COMPLETED - so every review
    comes from a patient who actually attended.
    """

    __tablename__ = "reviews"
    __table_args__ = (
        # One review per visit
        UniqueConstraint("appointment_id", name="uq_review_appointment"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=False)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    rating = Column(Integer, nullable=False)  # 1-5, validated at the API layer
    comment = Column(Text, nullable=True)

    appointment = relationship("Appointment")
    patient = relationship("Patient")
    doctor = relationship("Doctor")
