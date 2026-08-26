"""Transport models: TransportRun, TransportCargo."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base, TimestampMixin, UUIDMixin
from models.enums import TransportStatus


class TransportRun(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "transport_runs"

    order_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("logistics_orders.id", ondelete="CASCADE"), nullable=False
    )
    driver_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=True
    )
    vehicle_type_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("vehicle_types.id", ondelete="RESTRICT"), nullable=False
    )
    origin_stockpile_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("stockpiles.id", ondelete="RESTRICT"), nullable=False
    )
    destination_stockpile_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("stockpiles.id", ondelete="RESTRICT"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=TransportStatus.PLANNED.value
    )
    departed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    arrived_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    order: Mapped["models.logistics.LogisticsOrder"] = relationship()
    driver: Mapped["models.group.User"] = relationship()
    vehicle_type: Mapped["models.catalog.VehicleType"] = relationship()
    origin_stockpile: Mapped["models.stockpile.Stockpile"] = relationship(
        foreign_keys=[origin_stockpile_id]
    )
    destination_stockpile: Mapped["models.stockpile.Stockpile"] = relationship(
        foreign_keys=[destination_stockpile_id]
    )
    cargo: Mapped[list["TransportCargo"]] = relationship(
        back_populates="transport_run", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_transport_runs_order_status", "order_id", "status"),
        Index("ix_transport_runs_driver_status", "driver_id", "status"),
    )


class TransportCargo(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "transport_cargo"

    transport_run_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("transport_runs.id", ondelete="CASCADE"), nullable=False
    )
    resource_request_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("resource_requests.id", ondelete="RESTRICT"), nullable=False
    )
    quantity_crates: Mapped[int] = mapped_column(Integer, nullable=False)

    # Relationships
    transport_run: Mapped["TransportRun"] = relationship(back_populates="cargo")
    resource_request: Mapped["models.logistics.ResourceRequest"] = relationship()

    __table_args__ = (
        CheckConstraint(
            "quantity_crates > 0", name="ck_transport_cargo_qty_positive"
        ),
        Index(
            "ix_transport_cargo_run_request",
            "transport_run_id",
            "resource_request_id",
            unique=True,
        ),
    )
