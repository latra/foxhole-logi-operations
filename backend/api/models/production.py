"""ProductionTask model — two nullable FKs approach."""

from __future__ import annotations

from sqlalchemy import CheckConstraint, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base, TimestampMixin, UUIDMixin
from models.enums import ProductionStatus, ProductionTargetType


class ProductionTask(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "production_tasks"

    order_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("logistics_orders.id", ondelete="CASCADE"), nullable=False
    )
    target_type: Mapped[str] = mapped_column(String(30), nullable=False)

    # Two nullable FKs — exactly one must be set
    resource_request_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("resource_requests.id", ondelete="CASCADE"),
        nullable=True,
    )
    vehicle_request_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("vehicle_requests.id", ondelete="CASCADE"),
        nullable=True,
    )

    assignee_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=True
    )
    facility_stockpile_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("stockpiles.id", ondelete="RESTRICT"), nullable=True
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=ProductionStatus.TODO.value
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    order: Mapped["models.logistics.LogisticsOrder"] = relationship()
    resource_request: Mapped["models.logistics.ResourceRequest"] = relationship()
    vehicle_request: Mapped["models.logistics.VehicleRequest"] = relationship()
    assignee: Mapped["models.group.User"] = relationship()
    facility_stockpile: Mapped["models.stockpile.Stockpile"] = relationship()

    __table_args__ = (
        # Exactly one of the two FKs must be non-null
        CheckConstraint(
            "(resource_request_id IS NOT NULL AND vehicle_request_id IS NULL) "
            "OR (resource_request_id IS NULL AND vehicle_request_id IS NOT NULL)",
            name="ck_production_tasks_one_target",
        ),
        CheckConstraint("quantity > 0", name="ck_production_tasks_qty_positive"),
        Index("ix_production_tasks_order_status", "order_id", "status"),
        Index("ix_production_tasks_assignee_status", "assignee_id", "status"),
    )
