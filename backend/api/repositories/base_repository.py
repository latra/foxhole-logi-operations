"""Generic async CRUD repository."""

from typing import Any, Generic, Sequence, Type, TypeVar

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.base import Base

ModelT = TypeVar("ModelT", bound=Base)


class BaseRepository(Generic[ModelT]):
    """Reusable CRUD operations for any SQLAlchemy model."""

    def __init__(self, model: Type[ModelT]):
        self.model = model

    async def get_by_id(self, db: AsyncSession, entity_id: Any) -> ModelT | None:
        return await db.get(self.model, entity_id)

    async def list_all(
        self,
        db: AsyncSession,
        *,
        offset: int = 0,
        limit: int = 100,
        filters: dict[str, Any] | None = None,
    ) -> Sequence[ModelT]:
        stmt = select(self.model)
        if filters:
            for col_name, value in filters.items():
                col = getattr(self.model, col_name, None)
                if col is not None and value is not None:
                    stmt = stmt.where(col == value)
        stmt = stmt.offset(offset).limit(limit)
        result = await db.execute(stmt)
        return result.scalars().all()

    async def create(self, db: AsyncSession, **kwargs: Any) -> ModelT:
        instance = self.model(**kwargs)
        db.add(instance)
        await db.flush()
        return instance

    async def update(
        self, db: AsyncSession, entity_id: Any, **kwargs: Any
    ) -> ModelT | None:
        instance = await self.get_by_id(db, entity_id)
        if instance is None:
            return None
        # Callers pass **body.model_dump(exclude_unset=True) — only fields the
        # client actually included are present here, so a None here means the
        # client explicitly set that (nullable) field to null and it should be
        # cleared, not skipped.
        for key, value in kwargs.items():
            setattr(instance, key, value)
        await db.flush()
        return instance

    async def delete(self, db: AsyncSession, entity_id: Any) -> bool:
        instance = await self.get_by_id(db, entity_id)
        if instance is None:
            return False
        await db.delete(instance)
        await db.flush()
        return True
