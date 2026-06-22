"""add_device_tokens

Revision ID: f4b8d126e9a7
Revises: e1f7a3c9d502
Create Date: 2026-06-13 10:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f4b8d126e9a7'
down_revision: Union[str, None] = 'e1f7a3c9d502'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'device_tokens',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('subject_id', sa.Integer(), nullable=False),
        sa.Column('role', sa.String(length=10), nullable=False),
        sa.Column('expo_push_token', sa.String(length=200), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('expo_push_token', name='uq_device_expo_token'),
    )
    op.create_index('ix_device_tokens_subject_id', 'device_tokens', ['subject_id'])


def downgrade() -> None:
    op.drop_index('ix_device_tokens_subject_id', table_name='device_tokens')
    op.drop_table('device_tokens')
