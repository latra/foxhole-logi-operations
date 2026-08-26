"""add map_sessions

Revision ID: c9a1e2f6b8d3
Revises: e6d3a9c7f4b2
Create Date: 2026-08-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c9a1e2f6b8d3"
down_revision: str = "e6d3a9c7f4b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "map_sessions",
        sa.Column("code", sa.String(length=10), nullable=False),
        sa.Column("shapes", sa.JSON(), nullable=True),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("map_sessions", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_map_sessions_code"), ["code"], unique=True
        )


def downgrade() -> None:
    with op.batch_alter_table("map_sessions", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_map_sessions_code"))
    op.drop_table("map_sessions")
