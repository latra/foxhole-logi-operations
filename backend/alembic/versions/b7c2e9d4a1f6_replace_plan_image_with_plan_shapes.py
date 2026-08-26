"""replace plan_image_path with plan_shapes

Revision ID: b7c2e9d4a1f6
Revises: f1a2b3c4d5e6
Create Date: 2026-08-26 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b7c2e9d4a1f6"
down_revision: str = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("operations", sa.Column("plan_shapes", sa.JSON(), nullable=True))
    # No drop_column("plan_image_path") here: the v1 initial migration never
    # created that column (it predates plan_image_path being removed from the
    # model), so dropping it fails on a DB built purely from this chain. Any
    # environment that still has it from an old create_all()-managed schema
    # will just carry the harmless, unused column.


def downgrade() -> None:
    op.add_column("operations", sa.Column("plan_image_path", sa.String(500), nullable=True))
    op.drop_column("operations", "plan_shapes")
