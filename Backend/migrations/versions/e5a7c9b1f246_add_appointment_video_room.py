"""add_appointment_video_room

Revision ID: e5a7c9b1f246
Revises: d4e6f8a0b135
Create Date: 2026-06-17 19:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5a7c9b1f246'
down_revision: Union[str, None] = 'd4e6f8a0b135'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('appointments', sa.Column('video_room_url', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('appointments', 'video_room_url')
