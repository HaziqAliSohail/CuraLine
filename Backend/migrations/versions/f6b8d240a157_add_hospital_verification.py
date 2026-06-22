"""add_hospital_verification

Revision ID: f6b8d240a157
Revises: e5a7c9b1f246
Create Date: 2026-06-17 20:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f6b8d240a157'
down_revision: Union[str, None] = 'e5a7c9b1f246'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('hospitals', sa.Column('verification_status', sa.String(length=20), nullable=False, server_default='VERIFIED'))
    op.add_column('hospitals', sa.Column('org_npi', sa.String(length=10), nullable=True))
    op.add_column('doctors', sa.Column('is_hospital_admin', sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    op.drop_column('doctors', 'is_hospital_admin')
    op.drop_column('hospitals', 'org_npi')
    op.drop_column('hospitals', 'verification_status')
