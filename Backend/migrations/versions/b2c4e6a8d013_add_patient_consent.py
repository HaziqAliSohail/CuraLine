"""add_patient_consent

Revision ID: b2c4e6a8d013
Revises: 37bbdb3b115a
Create Date: 2026-06-17 17:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c4e6a8d013'
down_revision: Union[str, None] = '37bbdb3b115a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('patients', sa.Column('consent_version', sa.String(length=20), nullable=True))
    op.add_column('patients', sa.Column('consent_accepted_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('patients', 'consent_accepted_at')
    op.drop_column('patients', 'consent_version')
