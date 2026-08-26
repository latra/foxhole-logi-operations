"""Logistics models: LogisticsOrder, ResourceRequest, VehicleRequest,
LogisticsOrderVehicle, LogisticsOrderItem."""

from __future__ import annotations

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base, TimestampMixin, UUIDMixin
from models.enums import OrderStatus, Priority


class LogisticsOrder(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "logistics_orders"

    group_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("groups.id", ondelete="CASCADE"), nullable=False
    )
    operation_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("operations.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    source_stockpile_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("stockpiles.id", ondelete="RESTRICT"), nullable=True
    )
    destination_stockpile_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("stockpiles.id", ondelete="RESTRICT"), nullable=False
    )
    priority: Mapped[str] = mapped_column(
        String(20), nullable=False, default=Priority.REQUIRED.value
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=OrderStatus.DRAFT.value
    )
    deadline: Mapped[None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )

    # Relationships
    group: Mapped["models.group.Group"] = relationship()
    operation: Mapped["models.operation.Operation | None"] = relationship(
        back_populates="logistics_orders"
    )
    source_stockpile: Mapped["models.stockpile.Stockpile"] = relationship(
        foreign_keys=[source_stockpile_id]
    )
    destination_stockpile: Mapped["models.stockpile.Stockpile"] = relationship(
        foreign_keys=[destination_stockpile_id]
    )
    creator: Mapped["models.group.User"] = relationship()
    resource_requests: Mapped[list["ResourceRequest"]] = relationship(
        back_populates="order", cascade="all, delete-orphan"
    )
    vehicle_requests: Mapped[list["VehicleRequest"]] = relationship(
        back_populates="order", cascade="all, delete-orphan"
    )
    order_vehicles: Mapped[list["LogisticsOrderVehicle"]] = relationship(
        back_populates="order", cascade="all, delete-orphan"
    )
    order_items: Mapped[list["LogisticsOrderItem"]] = relationship(
        back_populates="order", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_logistics_orders_group_status", "group_id", "status"),
        Index("ix_logistics_orders_operation", "operation_id"),
    )


class ResourceRequest(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "resource_requests"

    order_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("logistics_orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    item_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("items.id", ondelete="RESTRICT"), nullable=False
    )
    quantity_crates: Mapped[int] = mapped_column(Integer, nullable=False)
    priority: Mapped[str] = mapped_column(
        String(20), nullable=False, default=Priority.REQUIRED.value
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    order: Mapped["LogisticsOrder"] = relationship(back_populates="resource_requests")
    item: Mapped["models.catalog.Item"] = relationship()

    __table_args__ = (
        CheckConstraint("quantity_crates > 0", name="ck_resource_requests_qty_positive"),
    )


class VehicleRequest(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "vehicle_requests"

    order_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("logistics_orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    vehicle_type_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("vehicle_types.id", ondelete="RESTRICT"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    priority: Mapped[str] = mapped_column(
        String(20), nullable=False, default=Priority.REQUIRED.value
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    order: Mapped["LogisticsOrder"] = relationship(back_populates="vehicle_requests")
    vehicle_type: Mapped["models.catalog.VehicleType"] = relationship()

    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_vehicle_requests_qty_positive"),
    )


class LogisticsOrderVehicle(UUIDMixin, TimestampMixin, Base):
    """A vehicle instance placed into a logistics order's slot-grid editor."""

    __tablename__ = "logistics_order_vehicles"

    order_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("logistics_orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    vehicle_type_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("vehicle_types.id", ondelete="RESTRICT"), nullable=False
    )
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    assigned_to: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Relationships
    order: Mapped["LogisticsOrder"] = relationship(back_populates="order_vehicles")
    vehicle_type: Mapped["models.catalog.VehicleType"] = relationship()
    items: Mapped[list["LogisticsOrderItem"]] = relationship(
        back_populates="vehicle", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_logistics_order_vehicles_order", "order_id", "sort_order"),
    )


class LogisticsOrderItem(UUIDMixin, TimestampMixin, Base):
    """A single item placed in one slot — either inside a vehicle, or
    unassigned (vehicle_id is null) within the order's editor."""

    __tablename__ = "logistics_order_items"

    order_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("logistics_orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    vehicle_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("logistics_order_vehicles.id", ondelete="CASCADE"), nullable=True
    )
    item_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("items.id", ondelete="RESTRICT"), nullable=False
    )
    slot_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    assigned_to: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Relationships
    order: Mapped["LogisticsOrder"] = relationship(back_populates="order_items")
    vehicle: Mapped["LogisticsOrderVehicle | None"] = relationship(back_populates="items")
    item: Mapped["models.catalog.Item"] = relationship()

    __table_args__ = (
        Index("ix_logistics_order_items_order", "order_id"),
        Index("ix_logistics_order_items_vehicle", "vehicle_id"),
    )
