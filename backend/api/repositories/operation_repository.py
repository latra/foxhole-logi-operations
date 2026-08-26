"""Operation, OperationGroupInvite, and OperationSignup repositories."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models.operation import Operation, OperationGroupInvite, OperationSignup
from repositories.base_repository import BaseRepository


class OperationRepository(BaseRepository[Operation]):
    def __init__(self):
        super().__init__(Operation)

    async def list_by_group(
        self, db: AsyncSession, group_id: str, *, offset: int = 0, limit: int = 100
    ) -> list[Operation]:
        result = await db.execute(
            select(Operation)
            .where(Operation.group_id == group_id)
            .options(selectinload(Operation.invited_groups).selectinload(OperationGroupInvite.group))
            .order_by(Operation.scheduled_at.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(result.scalars().unique().all())

    async def list_visible_to_groups(
        self,
        db: AsyncSession,
        group_ids: list[str],
        *,
        offset: int = 0,
        limit: int = 100,
    ) -> list[Operation]:
        """List operations where any of the given groups is the creator or invited."""
        # Operations created by these groups OR invited to these groups
        invited_op_ids = (
            select(OperationGroupInvite.operation_id)
            .where(OperationGroupInvite.group_id.in_(group_ids))
        )
        result = await db.execute(
            select(Operation)
            .where(
                (Operation.group_id.in_(group_ids))
                | (Operation.id.in_(invited_op_ids))
            )
            .options(selectinload(Operation.invited_groups).selectinload(OperationGroupInvite.group))
            .order_by(Operation.scheduled_at.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(result.scalars().unique().all())

    async def get_with_invites(self, db: AsyncSession, operation_id: str) -> Operation | None:
        result = await db.execute(
            select(Operation)
            .where(Operation.id == operation_id)
            .options(selectinload(Operation.invited_groups).selectinload(OperationGroupInvite.group))
        )
        return result.scalar_one_or_none()


class OperationGroupInviteRepository(BaseRepository[OperationGroupInvite]):
    def __init__(self):
        super().__init__(OperationGroupInvite)

    async def list_by_operation(
        self, db: AsyncSession, operation_id: str
    ) -> list[OperationGroupInvite]:
        result = await db.execute(
            select(OperationGroupInvite).where(
                OperationGroupInvite.operation_id == operation_id
            )
        )
        return list(result.scalars().all())

    async def delete_by_operation_and_group(
        self, db: AsyncSession, operation_id: str, group_id: str
    ) -> bool:
        result = await db.execute(
            select(OperationGroupInvite).where(
                OperationGroupInvite.operation_id == operation_id,
                OperationGroupInvite.group_id == group_id,
            )
        )
        invite = result.scalar_one_or_none()
        if not invite:
            return False
        await db.delete(invite)
        await db.flush()
        return True


class OperationSignupRepository(BaseRepository[OperationSignup]):
    def __init__(self):
        super().__init__(OperationSignup)

    async def get_by_operation_and_user(
        self, db: AsyncSession, operation_id: str, user_id: str
    ) -> OperationSignup | None:
        result = await db.execute(
            select(OperationSignup).where(
                OperationSignup.operation_id == operation_id,
                OperationSignup.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()

    async def list_by_operation(
        self, db: AsyncSession, operation_id: str
    ) -> list[OperationSignup]:
        result = await db.execute(
            select(OperationSignup)
            .where(OperationSignup.operation_id == operation_id)
            .options(selectinload(OperationSignup.user))
            .order_by(OperationSignup.signed_up_at)
        )
        return list(result.scalars().all())


operation_repo = OperationRepository()
invite_repo = OperationGroupInviteRepository()
signup_repo = OperationSignupRepository()
