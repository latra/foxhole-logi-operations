"""add debrief to operations

Revision ID: d5f1a8b3c2e4
Revises: a2f0c3d91e7b
Create Date: 2026-08-25 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d5f1a8b3c2e4"
down_revision: str = "c4e8f1a52b9d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("operations", sa.Column("debrief", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("operations", "debrief")
