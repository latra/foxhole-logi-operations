"""Logistics repositories: LogisticsOrder, ResourceRequest, VehicleRequest,
LogisticsOrderVehicle, LogisticsOrderItem."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.logistics import (
    LogisticsOrder,
    LogisticsOrderItem,
    LogisticsOrderVehicle,
    ResourceRequest,
    VehicleRequest,
)
from repositories.base_repository import BaseRepository


class LogisticsOrderRepository(BaseRepository[LogisticsOrder]):
    def __init__(self):
        super().__init__(LogisticsOrder)

    async def list_by_group(
        self, db: AsyncSession, group_id: str, *, offset: int = 0, limit: int = 100
    ) -> list[LogisticsOrder]:
        result = await db.execute(
            select(LogisticsOrder)
            .where(LogisticsOrder.group_id == group_id)
            .order_by(LogisticsOrder.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def list_by_operation(
        self, db: AsyncSession, operation_id: str, *, offset: int = 0, limit: int = 100
    ) -> list[LogisticsOrder]:
        result = await db.execute(
            select(LogisticsOrder)
            .where(LogisticsOrder.operation_id == operation_id)
            .order_by(LogisticsOrder.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(result.scalars().all())


class ResourceRequestRepository(BaseRepository[ResourceRequest]):
    def __init__(self):
        super().__init__(ResourceRequest)

    async def list_by_order(
        self, db: AsyncSession, order_id: str
    ) -> list[ResourceRequest]:
        result = await db.execute(
            select(ResourceRequest).where(ResourceRequest.order_id == order_id)
        )
        return list(result.scalars().all())


class VehicleRequestRepository(BaseRepository[VehicleRequest]):
    def __init__(self):
        super().__init__(VehicleRequest)

    async def list_by_order(
        self, db: AsyncSession, order_id: str
    ) -> list[VehicleRequest]:
        result = await db.execute(
            select(VehicleRequest).where(VehicleRequest.order_id == order_id)
        )
        return list(result.scalars().all())


class LogisticsOrderVehicleRepository(BaseRepository[LogisticsOrderVehicle]):
    def __init__(self):
        super().__init__(LogisticsOrderVehicle)

    async def list_by_order(
        self, db: AsyncSession, order_id: str
    ) -> list[LogisticsOrderVehicle]:
        result = await db.execute(
            select(LogisticsOrderVehicle)
            .where(LogisticsOrderVehicle.order_id == order_id)
            .order_by(LogisticsOrderVehicle.sort_order)
        )
        return list(result.scalars().all())

    async def next_sort_order(self, db: AsyncSession, order_id: str) -> int:
        result = await db.execute(
            select(func.count())
            .select_from(LogisticsOrderVehicle)
            .where(LogisticsOrderVehicle.order_id == order_id)
        )
        return (result.scalar_one() or 0) + 1


class LogisticsOrderItemRepository(BaseRepository[LogisticsOrderItem]):
    def __init__(self):
        super().__init__(LogisticsOrderItem)

    async def list_by_order(
        self, db: AsyncSession, order_id: str
    ) -> list[LogisticsOrderItem]:
        """Items for an order, pre-sorted so the frontend never has to:
        same item type grouped together, sub-grouped by assignee (unassigned
        first), and — within that — by slot. This is the single source of
        truth for display order; the DB does it once, here, every time."""
        result = await db.execute(
            select(LogisticsOrderItem)
            .where(LogisticsOrderItem.order_id == order_id)
            .order_by(
                LogisticsOrderItem.item_id,
                LogisticsOrderItem.assigned_to.asc().nullsfirst(),
                LogisticsOrderItem.slot_index,
            )
        )
        return list(result.scalars().all())

    async def compact_container(
        self, db: AsyncSession, order_id: str, vehicle_id: str | None
    ) -> None:
        """Renumber one container's (a vehicle's, or the unassigned area's)
        items to consecutive slot_index values 0..N-1, in the same grouped
        order as list_by_order — grouping same item types together and
        packing them to the start of the slot range, with no gaps or
        collisions. Called server-side, inside the caller's transaction,
        right after any mutation that can affect a container's contents —
        so the renumbering is atomic with the mutation instead of a
        multi-request client-side dance that can race with concurrent edits.
        """
        stmt = select(LogisticsOrderItem).where(
            LogisticsOrderItem.order_id == order_id
        )
        stmt = (
            stmt.where(LogisticsOrderItem.vehicle_id == vehicle_id)
            if vehicle_id is not None
            else stmt.where(LogisticsOrderItem.vehicle_id.is_(None))
        )
        stmt = stmt.order_by(
            LogisticsOrderItem.item_id,
            LogisticsOrderItem.assigned_to.asc().nullsfirst(),
            LogisticsOrderItem.slot_index,
        )
        result = await db.execute(stmt)
        for index, item in enumerate(result.scalars().all()):
            if item.slot_index != index:
                item.slot_index = index
        await db.flush()

    async def next_slot_index(
        self, db: AsyncSession, order_id: str, vehicle_id: str | None
    ) -> int:
        """First free slot index for a given vehicle (or the unassigned area
        when vehicle_id is None) — just past the current highest slot."""
        stmt = select(func.max(LogisticsOrderItem.slot_index)).where(
            LogisticsOrderItem.order_id == order_id
        )
        stmt = (
            stmt.where(LogisticsOrderItem.vehicle_id == vehicle_id)
            if vehicle_id is not None
            else stmt.where(LogisticsOrderItem.vehicle_id.is_(None))
        )
        result = await db.execute(stmt)
        current_max = result.scalar_one()
        return 0 if current_max is None else current_max + 1

    async def unassign_by_vehicle(self, db: AsyncSession, vehicle_id: str, order_id: str) -> None:
        """Move all items out of a vehicle (about to be removed) into the
        order's unassigned area, appended after whatever is already there."""
        items = await db.execute(
            select(LogisticsOrderItem).where(LogisticsOrderItem.vehicle_id == vehicle_id)
        )
        next_slot = await self.next_slot_index(db, order_id, None)
        for item in items.scalars().all():
            item.vehicle_id = None
            item.slot_index = next_slot
            next_slot += 1
        await db.flush()
        await self.compact_container(db, order_id, None)


logistics_order_repo = LogisticsOrderRepository()
resource_request_repo = ResourceRequestRepository()
vehicle_request_repo = VehicleRequestRepository()
order_vehicle_repo = LogisticsOrderVehicleRepository()
order_item_repo = LogisticsOrderItemRepository()
