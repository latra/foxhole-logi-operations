"""add logistics_order_vehicles and logistics_order_items tables

These back the slot-grid editor (vehicles placed into an order, and items
placed into vehicle/unassigned slots), including per-slot assignment and
completion tracking. Both tables existed only via the app's old
Base.metadata.create_all() startup call and were never captured by a
migration until now — see main.py for the removal of that call.

Revision ID: 87f66c3e26be
Revises: c9a1e2f6b8d3
Create Date: 2026-08-27 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "87f66c3e26be"
down_revision: str = "c9a1e2f6b8d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "logistics_order_vehicles",
        sa.Column("order_id", sa.String(length=36), nullable=False),
        sa.Column("vehicle_type_id", sa.Integer(), nullable=False),
        sa.Column("display_name", sa.String(length=100), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("assigned_to", sa.String(length=36), nullable=True),
        sa.Column("completed", sa.Boolean(), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["assigned_to"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["order_id"], ["logistics_orders.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["vehicle_type_id"], ["vehicle_types.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("logistics_order_vehicles", schema=None) as batch_op:
        batch_op.create_index(
            "ix_logistics_order_vehicles_order", ["order_id", "sort_order"], unique=False
        )

    op.create_table(
        "logistics_order_items",
        sa.Column("order_id", sa.String(length=36), nullable=False),
        sa.Column("vehicle_id", sa.String(length=36), nullable=True),
        sa.Column("item_id", sa.Integer(), nullable=False),
        sa.Column("slot_index", sa.Integer(), nullable=False),
        sa.Column("assigned_to", sa.String(length=36), nullable=True),
        sa.Column("completed", sa.Boolean(), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["assigned_to"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["item_id"], ["items.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["order_id"], ["logistics_orders.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["vehicle_id"], ["logistics_order_vehicles.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("logistics_order_items", schema=None) as batch_op:
        batch_op.create_index("ix_logistics_order_items_order", ["order_id"], unique=False)
        batch_op.create_index("ix_logistics_order_items_vehicle", ["vehicle_id"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("logistics_order_items", schema=None) as batch_op:
        batch_op.drop_index("ix_logistics_order_items_vehicle")
        batch_op.drop_index("ix_logistics_order_items_order")
    op.drop_table("logistics_order_items")

    with op.batch_alter_table("logistics_order_vehicles", schema=None) as batch_op:
        batch_op.drop_index("ix_logistics_order_vehicles_order")
    op.drop_table("logistics_order_vehicles")
