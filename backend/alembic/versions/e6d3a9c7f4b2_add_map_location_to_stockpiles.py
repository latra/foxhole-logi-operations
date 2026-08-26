"""add map location to stockpiles

Revision ID: e6d3a9c7f4b2
Revises: b7c2e9d4a1f6
Create Date: 2026-08-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e6d3a9c7f4b2"
down_revision: str = "b7c2e9d4a1f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("stockpiles", schema=None) as batch_op:
        batch_op.add_column(sa.Column("map_hex", sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column("map_x", sa.Float(), nullable=True))
        batch_op.add_column(sa.Column("map_y", sa.Float(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("stockpiles", schema=None) as batch_op:
        batch_op.drop_column("map_y")
        batch_op.drop_column("map_x")
        batch_op.drop_column("map_hex")
