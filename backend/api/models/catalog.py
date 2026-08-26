"""Catalog models — seed / read-only reference data."""

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Index, Integer, String, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base
from models.enums import Faction, ProductionFacility


class War(Base):
    __tablename__ = "wars"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    number: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    started_at: Mapped[None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_current: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Fields from Foxhole War API
    foxhole_war_id: Mapped[str | None] = mapped_column(String(100), nullable=True, unique=True)
    winner: Mapped[str | None] = mapped_column(String(20), nullable=True)  # NONE, WARDENS, COLONIALS
    conquest_start_time: Mapped[None] = mapped_column(DateTime(timezone=True), nullable=True)
    conquest_end_time: Mapped[None] = mapped_column(DateTime(timezone=True), nullable=True)
    resistance_start_time: Mapped[None] = mapped_column(DateTime(timezone=True), nullable=True)
    scheduled_conquest_end_time: Mapped[None] = mapped_column(DateTime(timezone=True), nullable=True)
    required_victory_towns: Mapped[int | None] = mapped_column(Integer, nullable=True)
    short_required_victory_towns: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Relationships
    regions: Mapped[list["Region"]] = relationship(back_populates="war")

    __table_args__ = (
        # Partial unique index: only one war can be current
        Index(
            "ix_wars_is_current_unique",
            "is_current",
            unique=True,
            postgresql_where=(is_current == True),  # noqa: E712
        ),
    )


class Region(Base):
    __tablename__ = "regions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    war_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("wars.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    hex_code: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Relationships
    war: Mapped["War"] = relationship(back_populates="regions")

    __table_args__ = (
        Index("ix_regions_war_name", "war_id", "name", unique=True),
    )


class Item(Base):
    __tablename__ = "items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    faction: Mapped[str] = mapped_column(String(20), nullable=False)
    # Units per full loose stack (uncrated) vs. units packed into one crate —
    # kept as two independent numbers since a crate's contents don't have to
    # match its loose stack size. See ItemForm / conversion helpers in the
    # frontend (utils/packaging.ts) for stack<->crate quantity conversion.
    stack_size: Mapped[int] = mapped_column(Integer, nullable=False)
    crate_size: Mapped[int] = mapped_column(Integer, nullable=False)
    produced_at: Mapped[str] = mapped_column(String(50), nullable=False)
    icon_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    __table_args__ = (
        CheckConstraint("stack_size > 0", name="ck_items_stack_size_positive"),
        CheckConstraint("crate_size > 0", name="ck_items_crate_size_positive"),
    )


class VehicleType(Base):
    __tablename__ = "vehicle_types"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    faction: Mapped[str] = mapped_column(String(20), nullable=False)
    produced_at: Mapped[str] = mapped_column(String(50), nullable=False)
    cargo_slots: Mapped[int | None] = mapped_column(Integer, nullable=True)
    icon_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
