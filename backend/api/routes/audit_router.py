"""AuditLog routes — read-only."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies import get_current_user
from repositories.audit_repository import audit_log_repo
from schemas.audit import AuditLogResponse

router = APIRouter(prefix="/audit-logs", tags=["audit"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[AuditLogResponse])
async def list_audit_logs(
    entity_type: str | None = Query(None),
    entity_id: str | None = Query(None),
    user_id: str | None = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    if entity_type and entity_id:
        return await audit_log_repo.list_by_entity(
            db, entity_type, entity_id, offset=offset, limit=limit
        )
    if user_id:
        return await audit_log_repo.list_by_user(db, user_id, offset=offset, limit=limit)
    return await audit_log_repo.list_all(db, offset=offset, limit=limit)
