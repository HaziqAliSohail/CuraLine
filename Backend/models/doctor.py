from sqlalchemy import Column, Enum, Integer, Numeric, String, Text, Time

from database.db import Base
from models.mixins import PersonalDataMixin, TimestampMixin


class Doctor(Base, PersonalDataMixin, TimestampMixin):

    # Availability Statuses
    AVAILABLE = "AVAILABLE"
    LEAVE = "LEAVE"
    OFFLINE = "OFFLINE"
    AVAILABILITY_STATUSES = [AVAILABLE, LEAVE, OFFLINE]

    # Application (onboarding) statuses — only APPROVED doctors are visible to
    # patients and able to log in to the portal.
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    APPLICATION_STATUSES = [PENDING, APPROVED, REJECTED]

    __tablename__ = "doctors"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # Set when admin provisions portal access; NULL means no portal login yet
    password_hash = Column(String(255), nullable=True)
    # Onboarding state: admin-created doctors are APPROVED immediately;
    # self-serve applications start as PENDING until credentials are verified.
    application_status = Column(String(20), default=APPROVED, nullable=False)
    # Medical license number supplied with self-serve applications
    license_number = Column(String(50), nullable=True)
    specialization = Column(String(100), nullable=False)
    qualification = Column(String(100), nullable=False)
    availability_status = Column(Enum(*AVAILABILITY_STATUSES, name="availability_status_enum"), default=AVAILABLE)
    consultation_fee = Column(Numeric(7, 2), nullable=False)
    reporting_time = Column(Time, nullable=False)
    leaving_time = Column(Time, nullable=False)
    rating = Column(Integer, default=5)
    # JSON-encoded list of accepted insurance plan names, e.g. '["Aetna","Cigna"]'
    accepted_insurance_plans = Column(Text, nullable=True)

