"""add_npi_fields_to_doctor

Revision ID: c5d28b94ae61
Revises: a9c3e7f51d84
Create Date: 2026-06-12 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c5d28b94ae61'
down_revision: Union[str, None] = 'a9c3e7f51d84'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('doctors', sa.Column('npi_number', sa.String(length=10), nullable=True))
    op.add_column(
        'doctors',
        sa.Column('npi_verification_status', sa.String(length=20), server_default='UNVERIFIED', nullable=False),
    )


def downgrade() -> None:
    op.drop_column('doctors', 'npi_verification_status')
    op.drop_column('doctors', 'npi_number')
