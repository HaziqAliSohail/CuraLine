"""add_doctor_application_fields

Revision ID: b3f8c2e91a47
Revises: 7c41aa90d2e3
Create Date: 2026-06-11 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3f8c2e91a47'
down_revision: Union[str, None] = '7c41aa90d2e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Existing doctors were admin-provisioned → grandfathered in as APPROVED
    op.add_column(
        'doctors',
        sa.Column('application_status', sa.String(length=20), server_default='APPROVED', nullable=False),
    )
    op.add_column('doctors', sa.Column('license_number', sa.String(length=50), nullable=True))


def downgrade() -> None:
    op.drop_column('doctors', 'license_number')
    op.drop_column('doctors', 'application_status')
