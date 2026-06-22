"""add_performance_indexes

Adds indexes on hot foreign-key and filter columns. Postgres does NOT
auto-index foreign keys, so the appointment-list, slot-search, and
severity-swap queries were doing full table scans that degrade as data grows.

Revision ID: b7e2f9a14c63
Revises: 4fe6754965da
Create Date: 2026-06-13 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'b7e2f9a14c63'
down_revision: Union[str, None] = '4fe6754965da'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index('ix_appointments_patient_id', 'appointments', ['patient_id'])
    op.create_index('ix_appointments_doctor_id', 'appointments', ['doctor_id'])
    op.create_index('ix_appointments_slot_id', 'appointments', ['slot_id'])
    op.create_index('ix_appointments_status', 'appointments', ['status'])
    op.create_index('ix_doctor_slots_doctor_id', 'doctor_slots', ['doctor_id'])
    op.create_index('ix_doctor_slots_date', 'doctor_slots', ['date'])
    op.create_index('ix_doctor_slots_is_available', 'doctor_slots', ['is_available'])


def downgrade() -> None:
    op.drop_index('ix_doctor_slots_is_available', table_name='doctor_slots')
    op.drop_index('ix_doctor_slots_date', table_name='doctor_slots')
    op.drop_index('ix_doctor_slots_doctor_id', table_name='doctor_slots')
    op.drop_index('ix_appointments_status', table_name='appointments')
    op.drop_index('ix_appointments_slot_id', table_name='appointments')
    op.drop_index('ix_appointments_doctor_id', table_name='appointments')
    op.drop_index('ix_appointments_patient_id', table_name='appointments')
