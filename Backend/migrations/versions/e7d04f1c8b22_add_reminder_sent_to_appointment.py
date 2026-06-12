"""add_reminder_sent_to_appointment

Revision ID: e7d04f1c8b22
Revises: b3f8c2e91a47
Create Date: 2026-06-11 23:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e7d04f1c8b22'
down_revision: Union[str, None] = 'b3f8c2e91a47'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'appointments',
        sa.Column('reminder_sent', sa.Boolean(), server_default=sa.text('false'), nullable=False),
    )


def downgrade() -> None:
    op.drop_column('appointments', 'reminder_sent')
