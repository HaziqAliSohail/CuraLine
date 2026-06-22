"""add_hospitals

Revision ID: d8e16f2a7c93
Revises: c5d28b94ae61
Create Date: 2026-06-12 12:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd8e16f2a7c93'
down_revision: Union[str, None] = 'c5d28b94ae61'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'hospitals',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('address', sa.String(length=255), nullable=True),
        sa.Column('phone', sa.String(length=15), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_hospitals_name', 'hospitals', ['name'])
    op.add_column('doctors', sa.Column('hospital_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_doctors_hospital', 'doctors', 'hospitals', ['hospital_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint('fk_doctors_hospital', 'doctors', type_='foreignkey')
    op.drop_column('doctors', 'hospital_id')
    op.drop_index('ix_hospitals_name', table_name='hospitals')
    op.drop_table('hospitals')
