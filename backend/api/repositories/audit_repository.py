"""AuditLog repository."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.audit import AuditLog
from repositories.base_repository import BaseRepository


class AuditLogRepository(BaseRepository[AuditLog]):
    def __init__(self):
        super().__init__(AuditLog)

    async def list_by_entity(
        self,
        db: AsyncSession,
        entity_type: str,
        entity_id: str,
        *,
        offset: int = 0,
        limit: int = 50,
    ) -> list[AuditLog]:
        result = await db.execute(
            select(AuditLog)
            .where(
                AuditLog.entity_type == entity_type,
                AuditLog.entity_id == entity_id,
            )
            .order_by(AuditLog.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def list_by_user(
        self, db: AsyncSession, user_id: str, *, offset: int = 0, limit: int = 50
    ) -> list[AuditLog]:
        result = await db.execute(
            select(AuditLog)
            .where(AuditLog.user_id == user_id)
            .order_by(AuditLog.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(result.scalars().all())


audit_log_repo = AuditLogRepository()
