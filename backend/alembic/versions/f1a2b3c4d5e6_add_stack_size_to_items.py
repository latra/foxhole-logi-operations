"""add stack_size to items

Revision ID: f1a2b3c4d5e6
Revises: d5f1a8b3c2e4
Create Date: 2026-08-25 12:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f1a2b3c4d5e6"
down_revision: str = "d5f1a8b3c2e4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("items", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("stack_size", sa.Integer(), nullable=False, server_default="1")
        )
        batch_op.create_check_constraint("ck_items_stack_size_positive", "stack_size > 0")

    with op.batch_alter_table("items", schema=None) as batch_op:
        batch_op.alter_column("stack_size", server_default=None)


def downgrade() -> None:
    with op.batch_alter_table("items", schema=None) as batch_op:
        batch_op.drop_constraint("ck_items_stack_size_positive", type_="check")
        batch_op.drop_column("stack_size")
