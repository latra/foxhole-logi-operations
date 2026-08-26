"""Group and GroupMembership repositories."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models.group import Group, GroupMembership
from models.enums import MembershipStatus
from repositories.base_repository import BaseRepository


class GroupRepository(BaseRepository[Group]):
    def __init__(self):
        super().__init__(Group)

    async def get_by_discord_guild(self, db: AsyncSession, guild_id: str) -> Group | None:
        result = await db.execute(
            select(Group).where(Group.discord_guild_id == guild_id)
        )
        return result.scalar_one_or_none()


class GroupMembershipRepository(BaseRepository[GroupMembership]):
    def __init__(self):
        super().__init__(GroupMembership)

    async def get_by_group_and_user(
        self, db: AsyncSession, group_id: str, user_id: str
    ) -> GroupMembership | None:
        result = await db.execute(
            select(GroupMembership).where(
                GroupMembership.group_id == group_id,
                GroupMembership.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_with_user(
        self, db: AsyncSession, membership_id: str
    ) -> GroupMembership | None:
        result = await db.execute(
            select(GroupMembership)
            .where(GroupMembership.id == membership_id)
            .options(selectinload(GroupMembership.user))
        )
        return result.scalar_one_or_none()

    async def list_active_members(
        self, db: AsyncSession, group_id: str
    ) -> list[GroupMembership]:
        result = await db.execute(
            select(GroupMembership)
            .where(
                GroupMembership.group_id == group_id,
                GroupMembership.status == MembershipStatus.ACTIVE.value,
            )
            .options(selectinload(GroupMembership.user))
            .order_by(GroupMembership.joined_at)
        )
        return list(result.scalars().all())

    async def list_pending_requests(
        self, db: AsyncSession, group_id: str
    ) -> list[GroupMembership]:
        result = await db.execute(
            select(GroupMembership)
            .where(
                GroupMembership.group_id == group_id,
                GroupMembership.status == MembershipStatus.PENDING.value,
            )
            .options(selectinload(GroupMembership.user))
            .order_by(GroupMembership.joined_at)
        )
        return list(result.scalars().all())

    async def list_all_members(
        self, db: AsyncSession, group_id: str
    ) -> list[GroupMembership]:
        """List all members (active + pending), exclude removed."""
        result = await db.execute(
            select(GroupMembership)
            .where(
                GroupMembership.group_id == group_id,
                GroupMembership.status.in_([
                    MembershipStatus.ACTIVE.value,
                    MembershipStatus.PENDING.value,
                ]),
            )
            .options(selectinload(GroupMembership.user))
            .order_by(GroupMembership.joined_at)
        )
        return list(result.scalars().all())


group_repo = GroupRepository()
membership_repo = GroupMembershipRepository()
