"""ProductionTask repository."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.production import ProductionTask
from repositories.base_repository import BaseRepository


class ProductionTaskRepository(BaseRepository[ProductionTask]):
    def __init__(self):
        super().__init__(ProductionTask)

    async def list_by_order(
        self, db: AsyncSession, order_id: str
    ) -> list[ProductionTask]:
        result = await db.execute(
            select(ProductionTask).where(ProductionTask.order_id == order_id)
        )
        return list(result.scalars().all())

    async def list_by_assignee(
        self, db: AsyncSession, user_id: str, *, status: str | None = None
    ) -> list[ProductionTask]:
        stmt = select(ProductionTask).where(ProductionTask.assignee_id == user_id)
        if status:
            stmt = stmt.where(ProductionTask.status == status)
        result = await db.execute(stmt)
        return list(result.scalars().all())


production_task_repo = ProductionTaskRepository()
