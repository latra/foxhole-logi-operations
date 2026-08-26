"""Add Foxhole War API fields to wars table.

Revision ID: c4e8f1a52b9d
Revises: a2f0c3d91e7b
Create Date: 2026-08-24
"""

from alembic import op
import sqlalchemy as sa

revision = "c4e8f1a52b9d"
down_revision = "a2f0c3d91e7b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("wars") as batch_op:
        batch_op.add_column(sa.Column("foxhole_war_id", sa.String(100), nullable=True))
        batch_op.add_column(sa.Column("winner", sa.String(20), nullable=True))
        batch_op.add_column(sa.Column("conquest_start_time", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("conquest_end_time", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("resistance_start_time", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("scheduled_conquest_end_time", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("required_victory_towns", sa.Integer, nullable=True))
        batch_op.add_column(sa.Column("short_required_victory_towns", sa.Integer, nullable=True))
        batch_op.create_unique_constraint("uq_wars_foxhole_war_id", ["foxhole_war_id"])


def downgrade() -> None:
    with op.batch_alter_table("wars") as batch_op:
        batch_op.drop_constraint("uq_wars_foxhole_war_id", type_="unique")
        batch_op.drop_column("short_required_victory_towns")
        batch_op.drop_column("required_victory_towns")
        batch_op.drop_column("scheduled_conquest_end_time")
        batch_op.drop_column("resistance_start_time")
        batch_op.drop_column("conquest_end_time")
        batch_op.drop_column("conquest_start_time")
        batch_op.drop_column("winner")
        batch_op.drop_column("foxhole_war_id")
