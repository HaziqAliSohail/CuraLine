from sqlalchemy import Column, Integer, String

from database.db import Base
from models.mixins import TimestampMixin


class PlatformAdmin(Base, TimestampMixin):
    """A platform operator (the marketplace's root of trust).

    Deliberately a separate identity from Patient: an operator is not a consumer
    of the product, has no medical data, and isn't bookable. Authorization for
    admin endpoints is based on holding an `admin`-role token tied to one of
    these rows - not a boolean flag bolted onto a patient account.
    """

    __tablename__ = "platform_admins"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), nullable=False)
    email = Column(String(100), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
