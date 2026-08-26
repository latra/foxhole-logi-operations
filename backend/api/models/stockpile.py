"""Stockpile model."""

from __future__ import annotations

from sqlalchemy import Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base, TimestampMixin, UUIDMixin
from models.enums import StockpileStructure, StockpileType


class Stockpile(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "stockpiles"

    group_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("groups.id", ondelete="CASCADE"), nullable=False
    )
    war_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("wars.id", ondelete="RESTRICT"), nullable=False
    )
    region_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("regions.id", ondelete="RESTRICT"), nullable=False
    )
    structure_type: Mapped[str] = mapped_column(String(30), nullable=False)
    code_6digit: Mapped[str] = mapped_column(String(6), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(
        String(20), nullable=False, default=StockpileType.PRIVATE.value
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Exact map location, optionally set by picking a structure (Storage Depot,
    # Seaport, etc.) on the War API map layer instead of just the region.
    # map_x/map_y are the War API's own fractional (0..1) coordinates within
    # that hex, so the point can be re-plotted regardless of the app's own
    # tile/pixel calibration.
    map_hex: Mapped[str | None] = mapped_column(String(50), nullable=True)
    map_x: Mapped[float | None] = mapped_column(Float, nullable=True)
    map_y: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Relationships
    group: Mapped["models.group.Group"] = relationship()
    war: Mapped["models.catalog.War"] = relationship()
    region: Mapped["models.catalog.Region"] = relationship()

    __table_args__ = (
        Index("ix_stockpiles_group_war", "group_id", "war_id"),
    )
