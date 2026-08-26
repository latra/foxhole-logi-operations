"""Add operation_group_invites table and simplify operation_signups.

Revision ID: a2f0c3d91e7b
Revises: 7b3865da33ce
Create Date: 2026-08-24
"""

from alembic import op
import sqlalchemy as sa

revision = "a2f0c3d91e7b"
down_revision = "7b3865da33ce"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create the operation_group_invites table
    op.create_table(
        "operation_group_invites",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "operation_id",
            sa.String(36),
            sa.ForeignKey("operations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "group_id",
            sa.String(36),
            sa.ForeignKey("groups.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("invited_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_op_group_invites_op_group",
        "operation_group_invites",
        ["operation_id", "group_id"],
        unique=True,
    )
    op.create_index(
        "ix_op_group_invites_group",
        "operation_group_invites",
        ["group_id"],
    )

    # Remove columns from operation_signups that are no longer needed
    # (requested_role, confirmed_role, notes)
    # For SQLite we need to use batch mode
    with op.batch_alter_table("operation_signups") as batch_op:
        batch_op.drop_column("requested_role")
        batch_op.drop_column("confirmed_role")
        batch_op.drop_column("notes")


def downgrade() -> None:
    with op.batch_alter_table("operation_signups") as batch_op:
        batch_op.add_column(sa.Column("requested_role", sa.String(100), nullable=True))
        batch_op.add_column(sa.Column("confirmed_role", sa.String(100), nullable=True))
        batch_op.add_column(sa.Column("notes", sa.Text, nullable=True))

    op.drop_index("ix_op_group_invites_group", table_name="operation_group_invites")
    op.drop_index("ix_op_group_invites_op_group", table_name="operation_group_invites")
    op.drop_table("operation_group_invites")
