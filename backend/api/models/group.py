"""Core models: Group, User, GroupMembership."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base, TimestampMixin, UUIDMixin
from models.enums import Faction, MembershipRole, MembershipStatus


class Group(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "groups"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    tag: Mapped[str] = mapped_column(String(50), nullable=False)
    faction: Mapped[str] = mapped_column(String(20), nullable=False)
    discord_guild_id: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False
    )
    discord_member_role_id: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )

    # Relationships
    memberships: Mapped[list["GroupMembership"]] = relationship(
        back_populates="group", cascade="all, delete-orphan"
    )


class User(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "users"

    discord_id: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True
    )
    username: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    access_token: Mapped[str | None] = mapped_column(String(500), nullable=True)
    refresh_token: Mapped[str | None] = mapped_column(String(500), nullable=True)
    token_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    memberships: Mapped[list["GroupMembership"]] = relationship(
        back_populates="user"
    )


class GroupMembership(UUIDMixin, Base):
    __tablename__ = "group_memberships"

    group_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("groups.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(30), nullable=False, default=MembershipRole.MEMBER.value)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=MembershipStatus.ACTIVE.value
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    left_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    group: Mapped["Group"] = relationship(back_populates="memberships")
    user: Mapped["User"] = relationship(back_populates="memberships")

    __table_args__ = (
        Index("ix_group_memberships_group_user", "group_id", "user_id", unique=True),
        Index("ix_group_memberships_group_status", "group_id", "status"),
    )
