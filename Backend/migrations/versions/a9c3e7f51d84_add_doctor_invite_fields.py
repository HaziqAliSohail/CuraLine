"""add_doctor_invite_fields

Revision ID: a9c3e7f51d84
Revises: a1b2c3d4e5f6
Create Date: 2026-06-12 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a9c3e7f51d84'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('doctors', sa.Column('invite_token', sa.String(length=64), nullable=True))
    op.add_column('doctors', sa.Column('invite_expires_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index('ix_doctors_invite_token', 'doctors', ['invite_token'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_doctors_invite_token', table_name='doctors')
    op.drop_column('doctors', 'invite_expires_at')
    op.drop_column('doctors', 'invite_token')
