"""Map session repository."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.map_session import MapSession
from repositories.base_repository import BaseRepository


class MapSessionRepository(BaseRepository[MapSession]):
    def __init__(self):
        super().__init__(MapSession)

    async def get_by_code(self, db: AsyncSession, code: str) -> MapSession | None:
        result = await db.execute(select(MapSession).where(MapSession.code == code))
        return result.scalar_one_or_none()


map_session_repo = MapSessionRepository()
