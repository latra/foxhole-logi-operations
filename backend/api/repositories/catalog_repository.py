"""Catalog repositories: War, Region, Item, VehicleType."""

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from models.catalog import Item, Region, VehicleType, War
from repositories.base_repository import BaseRepository


class WarRepository(BaseRepository[War]):
    def __init__(self):
        super().__init__(War)

    async def get_current(self, db: AsyncSession) -> War | None:
        result = await db.execute(
            select(War).where(War.is_current == True)  # noqa: E712
        )
        return result.scalar_one_or_none()

    async def get_by_number(self, db: AsyncSession, number: int) -> War | None:
        result = await db.execute(
            select(War).where(War.number == number)
        )
        return result.scalar_one_or_none()

    async def clear_current(self, db: AsyncSession) -> None:
        """Remove is_current flag from all wars."""
        await db.execute(
            update(War).where(War.is_current == True).values(is_current=False)  # noqa: E712
        )
        await db.flush()


class RegionRepository(BaseRepository[Region]):
    def __init__(self):
        super().__init__(Region)

    async def list_by_war(self, db: AsyncSession, war_id: int) -> list[Region]:
        result = await db.execute(
            select(Region).where(Region.war_id == war_id)
        )
        return list(result.scalars().all())

    async def get_by_war_and_name(
        self, db: AsyncSession, war_id: int, name: str
    ) -> Region | None:
        result = await db.execute(
            select(Region).where(Region.war_id == war_id, Region.name == name)
        )
        return result.scalar_one_or_none()


class ItemRepository(BaseRepository[Item]):
    def __init__(self):
        super().__init__(Item)

    async def get_by_code(self, db: AsyncSession, code: str) -> Item | None:
        result = await db.execute(select(Item).where(Item.code == code))
        return result.scalar_one_or_none()


class VehicleTypeRepository(BaseRepository[VehicleType]):
    def __init__(self):
        super().__init__(VehicleType)

    async def get_by_code(self, db: AsyncSession, code: str) -> VehicleType | None:
        result = await db.execute(
            select(VehicleType).where(VehicleType.code == code)
        )
        return result.scalar_one_or_none()


war_repo = WarRepository()
region_repo = RegionRepository()
item_repo = ItemRepository()
vehicle_type_repo = VehicleTypeRepository()
