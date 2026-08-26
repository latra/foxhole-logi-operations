"""Operation, OperationGroupInvite, and OperationSignup models."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base, TimestampMixin, UUIDMixin
from models.enums import OperationStatus, SignupStatus


class Operation(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "operations"

    group_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("groups.id", ondelete="CASCADE"), nullable=False
    )
    war_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("wars.id", ondelete="RESTRICT"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    scheduled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    region_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("regions.id", ondelete="RESTRICT"), nullable=True
    )
    location_detail: Mapped[str | None] = mapped_column(String(500), nullable=True)
    plan_shapes: Mapped[list | None] = mapped_column(JSON, nullable=True)
    debrief: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=OperationStatus.PLANNED.value
    )
    created_by: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )

    # Relationships
    group: Mapped["models.group.Group"] = relationship()
    war: Mapped["models.catalog.War"] = relationship()
    region: Mapped["models.catalog.Region"] = relationship()
    creator: Mapped["models.group.User"] = relationship()
    signups: Mapped[list["OperationSignup"]] = relationship(
        back_populates="operation", cascade="all, delete-orphan"
    )
    invited_groups: Mapped[list["OperationGroupInvite"]] = relationship(
        back_populates="operation", cascade="all, delete-orphan"
    )
    # Logistics orders linked to this operation (LogisticsOrder.operation_id).
    # No cascade: unlinking an order should SET NULL, never delete it — see
    # the ondelete="SET NULL" on that FK.
    logistics_orders: Mapped[list["models.logistics.LogisticsOrder"]] = relationship(
        back_populates="operation"
    )

    __table_args__ = (
        Index("ix_operations_group_scheduled", "group_id", "scheduled_at"),
        Index("ix_operations_status", "status"),
    )


class OperationGroupInvite(UUIDMixin, Base):
    """Many-to-many: which groups are invited to see/join an operation."""
    __tablename__ = "operation_group_invites"

    operation_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("operations.id", ondelete="CASCADE"), nullable=False
    )
    group_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("groups.id", ondelete="CASCADE"), nullable=False
    )
    invited_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    operation: Mapped["Operation"] = relationship(back_populates="invited_groups")
    group: Mapped["models.group.Group"] = relationship()

    __table_args__ = (
        Index(
            "ix_op_group_invites_op_group",
            "operation_id",
            "group_id",
            unique=True,
        ),
        Index("ix_op_group_invites_group", "group_id"),
    )


class OperationSignup(UUIDMixin, Base):
    __tablename__ = "operation_signups"

    operation_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("operations.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=SignupStatus.ATTENDING.value
    )
    signed_up_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    operation: Mapped["Operation"] = relationship(back_populates="signups")
    user: Mapped["models.group.User"] = relationship()

    __table_args__ = (
        Index("ix_operation_signups_op_user", "operation_id", "user_id", unique=True),
    )
