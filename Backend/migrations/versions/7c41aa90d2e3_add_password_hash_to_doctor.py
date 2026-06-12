"""add_password_hash_to_doctor

Revision ID: 7c41aa90d2e3
Revises: 0de57ffb15c1
Create Date: 2026-06-11 20:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7c41aa90d2e3'
down_revision: Union[str, None] = '0de57ffb15c1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('doctors', sa.Column('password_hash', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('doctors', 'password_hash')
