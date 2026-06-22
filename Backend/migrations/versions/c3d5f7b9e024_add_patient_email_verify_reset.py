"""add_patient_email_verify_reset

Revision ID: c3d5f7b9e024
Revises: b2c4e6a8d013
Create Date: 2026-06-17 18:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d5f7b9e024'
down_revision: Union[str, None] = 'b2c4e6a8d013'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('patients', sa.Column('email_verified', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('patients', sa.Column('verification_token_hash', sa.String(length=64), nullable=True))
    op.add_column('patients', sa.Column('verification_expires_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('patients', sa.Column('reset_token_hash', sa.String(length=64), nullable=True))
    op.add_column('patients', sa.Column('reset_expires_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('patients', 'reset_expires_at')
    op.drop_column('patients', 'reset_token_hash')
    op.drop_column('patients', 'verification_expires_at')
    op.drop_column('patients', 'verification_token_hash')
    op.drop_column('patients', 'email_verified')
