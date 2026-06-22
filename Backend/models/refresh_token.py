from sqlalchemy import Boolean, Column, DateTime, Integer, String

from database.db import Base
from models.mixins import TimestampMixin


class RefreshToken(Base, TimestampMixin):
    """Server-side record of an issued refresh token (rotation + revocation).

    Only the SHA-256 hash of the token is stored - a database leak does not
    leak usable tokens. Rotation: each refresh revokes the old row and issues
    a new one; reuse of a revoked token signals theft and revokes the whole
    family for that subject.
    """

    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, autoincrement=True)
    subject_id = Column(Integer, nullable=False, index=True)
    role = Column(String(10), nullable=False)  # patient | doctor
    token_hash = Column(String(64), nullable=False, unique=True, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked = Column(Boolean, default=False, nullable=False)
