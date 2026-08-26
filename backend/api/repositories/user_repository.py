"""User repository with Discord-specific lookups."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.group import User
from repositories.base_repository import BaseRepository


class UserRepository(BaseRepository[User]):
    def __init__(self):
        super().__init__(User)

    async def get_by_discord_id(self, db: AsyncSession, discord_id: str) -> User | None:
        result = await db.execute(
            select(User).where(User.discord_id == discord_id)
        )
        return result.scalar_one_or_none()

    async def upsert_discord_user(
        self,
        db: AsyncSession,
        *,
        discord_id: str,
        username: str,
        display_name: str,
        avatar_url: str | None = None,
        access_token: str | None = None,
        refresh_token: str | None = None,
        token_expires_at=None,
    ) -> User:
        user = await self.get_by_discord_id(db, discord_id)
        if user is None:
            user = await self.create(
                db,
                discord_id=discord_id,
                username=username,
                display_name=display_name,
                avatar_url=avatar_url,
                access_token=access_token,
                refresh_token=refresh_token,
                token_expires_at=token_expires_at,
            )
        else:
            user.username = username
            user.display_name = display_name
            if avatar_url:
                user.avatar_url = avatar_url
            if access_token:
                user.access_token = access_token
            if refresh_token:
                user.refresh_token = refresh_token
            if token_expires_at:
                user.token_expires_at = token_expires_at
            await db.flush()
        return user


user_repo = UserRepository()
