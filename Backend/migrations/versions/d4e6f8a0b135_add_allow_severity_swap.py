"""add_allow_severity_swap

Revision ID: d4e6f8a0b135
Revises: c3d5f7b9e024
Create Date: 2026-06-17 18:55:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e6f8a0b135'
down_revision: Union[str, None] = 'c3d5f7b9e024'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('patients', sa.Column('allow_severity_swap', sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    op.drop_column('patients', 'allow_severity_swap')
