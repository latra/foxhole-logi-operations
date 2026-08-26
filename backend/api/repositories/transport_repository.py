"""Transport repositories: TransportRun, TransportCargo."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.transport import TransportCargo, TransportRun
from repositories.base_repository import BaseRepository


class TransportRunRepository(BaseRepository[TransportRun]):
    def __init__(self):
        super().__init__(TransportRun)

    async def list_by_order(
        self, db: AsyncSession, order_id: str
    ) -> list[TransportRun]:
        result = await db.execute(
            select(TransportRun).where(TransportRun.order_id == order_id)
        )
        return list(result.scalars().all())

    async def list_by_driver(
        self, db: AsyncSession, user_id: str, *, status: str | None = None
    ) -> list[TransportRun]:
        stmt = select(TransportRun).where(TransportRun.driver_id == user_id)
        if status:
            stmt = stmt.where(TransportRun.status == status)
        result = await db.execute(stmt)
        return list(result.scalars().all())


class TransportCargoRepository(BaseRepository[TransportCargo]):
    def __init__(self):
        super().__init__(TransportCargo)

    async def list_by_run(
        self, db: AsyncSession, transport_run_id: str
    ) -> list[TransportCargo]:
        result = await db.execute(
            select(TransportCargo).where(
                TransportCargo.transport_run_id == transport_run_id
            )
        )
        return list(result.scalars().all())


transport_run_repo = TransportRunRepository()
transport_cargo_repo = TransportCargoRepository()
