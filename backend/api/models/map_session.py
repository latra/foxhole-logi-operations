"""Collaborative map session model — persists shared drawing state by code."""

from __future__ import annotations

from sqlalchemy import JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base, TimestampMixin, UUIDMixin


class MapSession(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "map_sessions"

    # Short human-shareable code (see generate_session_code) — how a session
    # is found and rejoined later, possibly long after everyone disconnected.
    code: Mapped[str] = mapped_column(String(10), unique=True, nullable=False, index=True)
    shapes: Mapped[list | None] = mapped_column(JSON, nullable=True)
