"""Stockpile repository."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.stockpile import Stockpile
from repositories.base_repository import BaseRepository


class StockpileRepository(BaseRepository[Stockpile]):
    def __init__(self):
        super().__init__(Stockpile)

    async def list_by_group_and_war(
        self, db: AsyncSession, group_id: str, war_id: int
    ) -> list[Stockpile]:
        result = await db.execute(
            select(Stockpile).where(
                Stockpile.group_id == group_id,
                Stockpile.war_id == war_id,
            )
        )
        return list(result.scalars().all())


stockpile_repo = StockpileRepository()
