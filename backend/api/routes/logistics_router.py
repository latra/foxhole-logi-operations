"""Logistics routes: LogisticsOrder, ResourceRequest, VehicleRequest."""

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession

from auth import decode_access_token
from database import get_db
from dependencies import get_current_user
from models.enums import MembershipStatus
from models.group import User
from repositories.catalog_repository import vehicle_type_repo
from repositories.group_repository import membership_repo
from repositories.operation_repository import operation_repo
from repositories.logistics_repository import (
    logistics_order_repo,
    order_item_repo,
    order_vehicle_repo,
    resource_request_repo,
    vehicle_request_repo,
)
from repositories.user_repository import user_repo
from schemas.logistics import (
    LogisticsOrderCreate,
    LogisticsOrderItemCreate,
    LogisticsOrderItemMove,
    LogisticsOrderItemResponse,
    LogisticsOrderResponse,
    LogisticsOrderUpdate,
    LogisticsOrderVehicleCreate,
    LogisticsOrderVehicleResponse,
    LogisticsOrderVehicleUpdate,
    ResourceRequestCreate,
    ResourceRequestResponse,
    ResourceRequestUpdate,
    VehicleRequestCreate,
    VehicleRequestResponse,
    VehicleRequestUpdate,
)
from ws_manager import logistics_ws_manager

router = APIRouter(prefix="/logistics", tags=["logistics"], dependencies=[Depends(get_current_user)])

# A separate router for the WebSocket endpoint: it deliberately does NOT carry
# the `Depends(get_current_user)` above (that dependency expects an HTTP
# Authorization header via OAuth2PasswordBearer, which a browser WebSocket
# can't send) — auth here is done manually from a `?token=` query param instead.
ws_router = APIRouter(prefix="/logistics", tags=["logistics-ws"])


# ── LogisticsOrder ───────────────────────────────────────────────────────

@router.get("", response_model=list[LogisticsOrderResponse])
async def list_orders(
    group_id: str | None = Query(None),
    operation_id: str | None = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    if operation_id:
        return await logistics_order_repo.list_by_operation(
            db, operation_id, offset=offset, limit=limit
        )
    if group_id:
        return await logistics_order_repo.list_by_group(db, group_id, offset=offset, limit=limit)
    raise HTTPException(status.HTTP_400_BAD_REQUEST, "group_id or operation_id is required")


@router.get("/{order_id}", response_model=LogisticsOrderResponse)
async def get_order(order_id: str, db: AsyncSession = Depends(get_db)):
    order = await logistics_order_repo.get_by_id(db, order_id)
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Logistics order not found")
    return order


@router.post("", response_model=LogisticsOrderResponse, status_code=201)
async def create_order(
    body: LogisticsOrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.operation_id is not None:
        linked_op = await operation_repo.get_by_id(db, body.operation_id)
        if not linked_op:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Operation not found")

    order = await logistics_order_repo.create(
        db, **body.model_dump(), created_by=current_user.id
    )
    await db.commit()
    return order


@router.patch("/{order_id}", response_model=LogisticsOrderResponse)
async def update_order(
    order_id: str, body: LogisticsOrderUpdate, db: AsyncSession = Depends(get_db)
):
    order = await logistics_order_repo.get_by_id(db, order_id)
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Logistics order not found")

    # Applied field-by-field (rather than the generic repo.update helper,
    # which skips any field explicitly set to None) so operation_id,
    # source_stockpile_id, deadline, and notes can actually be cleared back
    # to null — e.g. unlinking a logistics list from its operation.
    data = body.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        order.name = data["name"]
    if "operation_id" in data:
        if data["operation_id"] is not None:
            linked_op = await operation_repo.get_by_id(db, data["operation_id"])
            if not linked_op:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "Operation not found")
        order.operation_id = data["operation_id"]
    if "source_stockpile_id" in data:
        order.source_stockpile_id = data["source_stockpile_id"]
    if "destination_stockpile_id" in data and data["destination_stockpile_id"] is not None:
        order.destination_stockpile_id = data["destination_stockpile_id"]
    if "priority" in data and data["priority"] is not None:
        order.priority = data["priority"].value
    if "status" in data and data["status"] is not None:
        order.status = data["status"].value
    if "deadline" in data:
        order.deadline = data["deadline"]
    if "notes" in data:
        order.notes = data["notes"]

    await db.flush()
    await db.commit()
    await logistics_ws_manager.broadcast(order_id, {"event": "order_changed"})
    return order


@router.delete("/{order_id}", status_code=204)
async def delete_order(order_id: str, db: AsyncSession = Depends(get_db)):
    if not await logistics_order_repo.delete(db, order_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Logistics order not found")
    await db.commit()


# ── ResourceRequests ─────────────────────────────────────────────────────

@router.get("/{order_id}/resource-requests", response_model=list[ResourceRequestResponse])
async def list_resource_requests(order_id: str, db: AsyncSession = Depends(get_db)):
    return await resource_request_repo.list_by_order(db, order_id)


@router.post(
    "/{order_id}/resource-requests",
    response_model=ResourceRequestResponse,
    status_code=201,
)
async def create_resource_request(
    order_id: str, body: ResourceRequestCreate, db: AsyncSession = Depends(get_db)
):
    rr = await resource_request_repo.create(db, order_id=order_id, **body.model_dump(exclude={"order_id"}))
    await db.commit()
    return rr


@router.patch(
    "/{order_id}/resource-requests/{rr_id}",
    response_model=ResourceRequestResponse,
)
async def update_resource_request(
    order_id: str,
    rr_id: str,
    body: ResourceRequestUpdate,
    db: AsyncSession = Depends(get_db),
):
    data = body.model_dump(exclude_unset=True)
    if "priority" in data and data["priority"] is not None:
        data["priority"] = data["priority"].value
    rr = await resource_request_repo.update(db, rr_id, **data)
    if not rr:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Resource request not found")
    await db.commit()
    return rr


@router.delete("/{order_id}/resource-requests/{rr_id}", status_code=204)
async def delete_resource_request(
    order_id: str, rr_id: str, db: AsyncSession = Depends(get_db)
):
    if not await resource_request_repo.delete(db, rr_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Resource request not found")
    await db.commit()


# ── VehicleRequests ──────────────────────────────────────────────────────

@router.get("/{order_id}/vehicle-requests", response_model=list[VehicleRequestResponse])
async def list_vehicle_requests(order_id: str, db: AsyncSession = Depends(get_db)):
    return await vehicle_request_repo.list_by_order(db, order_id)


@router.post(
    "/{order_id}/vehicle-requests",
    response_model=VehicleRequestResponse,
    status_code=201,
)
async def create_vehicle_request(
    order_id: str, body: VehicleRequestCreate, db: AsyncSession = Depends(get_db)
):
    vr = await vehicle_request_repo.create(db, order_id=order_id, **body.model_dump(exclude={"order_id"}))
    await db.commit()
    return vr


@router.patch(
    "/{order_id}/vehicle-requests/{vr_id}",
    response_model=VehicleRequestResponse,
)
async def update_vehicle_request(
    order_id: str,
    vr_id: str,
    body: VehicleRequestUpdate,
    db: AsyncSession = Depends(get_db),
):
    data = body.model_dump(exclude_unset=True)
    if "priority" in data and data["priority"] is not None:
        data["priority"] = data["priority"].value
    vr = await vehicle_request_repo.update(db, vr_id, **data)
    if not vr:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Vehicle request not found")
    await db.commit()
    return vr


@router.delete("/{order_id}/vehicle-requests/{vr_id}", status_code=204)
async def delete_vehicle_request(
    order_id: str, vr_id: str, db: AsyncSession = Depends(get_db)
):
    if not await vehicle_request_repo.delete(db, vr_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Vehicle request not found")
    await db.commit()


# ── Order Vehicles (slot-grid editor) ────────────────────────────────────

@router.get("/{order_id}/vehicles", response_model=list[LogisticsOrderVehicleResponse])
async def list_order_vehicles(order_id: str, db: AsyncSession = Depends(get_db)):
    return await order_vehicle_repo.list_by_order(db, order_id)


@router.post(
    "/{order_id}/vehicles",
    response_model=LogisticsOrderVehicleResponse,
    status_code=201,
)
async def add_order_vehicle(
    order_id: str, body: LogisticsOrderVehicleCreate, db: AsyncSession = Depends(get_db)
):
    vehicle_type = await vehicle_type_repo.get_by_id(db, body.vehicle_type_id)
    if not vehicle_type:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Vehicle type not found")

    display_name = body.display_name
    if not display_name:
        n = await order_vehicle_repo.next_sort_order(db, order_id)
        display_name = f"Vehicle {n}"

    ov = await order_vehicle_repo.create(
        db,
        order_id=order_id,
        vehicle_type_id=body.vehicle_type_id,
        display_name=display_name,
        sort_order=await order_vehicle_repo.next_sort_order(db, order_id),
    )
    await db.commit()
    await logistics_ws_manager.broadcast(order_id, {"event": "vehicles_changed"})
    return ov


@router.patch(
    "/{order_id}/vehicles/{vehicle_id}",
    response_model=LogisticsOrderVehicleResponse,
)
async def update_order_vehicle(
    order_id: str,
    vehicle_id: str,
    body: LogisticsOrderVehicleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.assigned_to is not None and body.assigned_to != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only assign this to yourself.")

    ov = await order_vehicle_repo.update(db, vehicle_id, **body.model_dump(exclude_unset=True))
    if not ov or ov.order_id != order_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Vehicle not found")
    await db.commit()
    await logistics_ws_manager.broadcast(order_id, {"event": "vehicles_changed"})
    return ov


@router.delete("/{order_id}/vehicles/{vehicle_id}", status_code=204)
async def remove_order_vehicle(
    order_id: str, vehicle_id: str, db: AsyncSession = Depends(get_db)
):
    ov = await order_vehicle_repo.get_by_id(db, vehicle_id)
    if not ov or ov.order_id != order_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Vehicle not found")

    # Move its items back to the unassigned area before removing the vehicle
    await order_item_repo.unassign_by_vehicle(db, vehicle_id, order_id)
    await order_vehicle_repo.delete(db, vehicle_id)
    await db.commit()
    await logistics_ws_manager.broadcast(order_id, {"event": "vehicles_changed"})
    await logistics_ws_manager.broadcast(order_id, {"event": "items_changed"})


# ── Order Items (slot-grid editor) ───────────────────────────────────────

@router.get("/{order_id}/items", response_model=list[LogisticsOrderItemResponse])
async def list_order_items(order_id: str, db: AsyncSession = Depends(get_db)):
    return await order_item_repo.list_by_order(db, order_id)


@router.post(
    "/{order_id}/items",
    response_model=LogisticsOrderItemResponse,
    status_code=201,
)
async def add_order_item(
    order_id: str, body: LogisticsOrderItemCreate, db: AsyncSession = Depends(get_db)
):
    vehicle_id = body.vehicle_id

    if vehicle_id is not None:
        vehicle = await order_vehicle_repo.get_by_id(db, vehicle_id)
        if not vehicle or vehicle.order_id != order_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Vehicle not found")

        vehicle_type = await vehicle_type_repo.get_by_id(db, vehicle.vehicle_type_id)
        capacity = vehicle_type.cargo_slots if vehicle_type else None
        if capacity is not None:
            existing = await order_item_repo.list_by_order(db, order_id)
            used = sum(1 for i in existing if i.vehicle_id == vehicle_id)
            if used >= capacity:
                raise HTTPException(status.HTTP_409_CONFLICT, "Vehicle full")

    slot_index = body.slot_index
    if slot_index is None:
        slot_index = await order_item_repo.next_slot_index(db, order_id, vehicle_id)

    oi = await order_item_repo.create(
        db,
        order_id=order_id,
        vehicle_id=vehicle_id,
        item_id=body.item_id,
        slot_index=slot_index,
    )
    await order_item_repo.compact_container(db, order_id, vehicle_id)
    await db.commit()
    await logistics_ws_manager.broadcast(order_id, {"event": "items_changed"})
    return oi


@router.patch(
    "/{order_id}/items/{item_id}",
    response_model=LogisticsOrderItemResponse,
)
async def move_order_item(
    order_id: str,
    item_id: str,
    body: LogisticsOrderItemMove,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.assigned_to is not None and body.assigned_to != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only assign this to yourself.")

    oi = await order_item_repo.get_by_id(db, item_id)
    if not oi or oi.order_id != order_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Item not found")

    data = body.model_dump(exclude_unset=True)
    source_vehicle_id = oi.vehicle_id

    target_vehicle_id = data.get("vehicle_id", oi.vehicle_id) if "vehicle_id" in data else oi.vehicle_id
    if "vehicle_id" in data and target_vehicle_id is not None:
        vehicle = await order_vehicle_repo.get_by_id(db, target_vehicle_id)
        if not vehicle or vehicle.order_id != order_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Vehicle not found")

        vehicle_type = await vehicle_type_repo.get_by_id(db, vehicle.vehicle_type_id)
        capacity = vehicle_type.cargo_slots if vehicle_type else None
        if capacity is not None:
            existing = await order_item_repo.list_by_order(db, order_id)
            used = sum(
                1 for i in existing if i.vehicle_id == target_vehicle_id and i.id != oi.id
            )
            if used >= capacity:
                raise HTTPException(status.HTTP_409_CONFLICT, "Vehicle full")

    if "vehicle_id" in data:
        oi.vehicle_id = data["vehicle_id"]
    if "slot_index" in data and data["slot_index"] is not None:
        oi.slot_index = data["slot_index"]
    if "assigned_to" in data:
        oi.assigned_to = data["assigned_to"]
    if "completed" in data and data["completed"] is not None:
        oi.completed = data["completed"]

    await db.flush()
    await order_item_repo.compact_container(db, order_id, oi.vehicle_id)
    if oi.vehicle_id != source_vehicle_id:
        await order_item_repo.compact_container(db, order_id, source_vehicle_id)
    await db.commit()
    await logistics_ws_manager.broadcast(order_id, {"event": "items_changed"})
    return oi


@router.delete("/{order_id}/items/{item_id}", status_code=204)
async def remove_order_item(
    order_id: str, item_id: str, db: AsyncSession = Depends(get_db)
):
    oi = await order_item_repo.get_by_id(db, item_id)
    if not oi or oi.order_id != order_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Item not found")
    vehicle_id = oi.vehicle_id
    await order_item_repo.delete(db, item_id)
    await order_item_repo.compact_container(db, order_id, vehicle_id)
    await db.commit()
    await logistics_ws_manager.broadcast(order_id, {"event": "items_changed"})


# ── Real-time updates ────────────────────────────────────────────────────
#
# One WebSocket room per logistics order (order_id). A client connects to
# /logistics/{order_id}/ws and only ever receives events for that specific
# order — connections are keyed strictly by order_id in `logistics_ws_manager`,
# so two different logistics plans never share a room, cross-broadcast, or
# otherwise leak activity into each other.

@ws_router.websocket("/{order_id}/ws")
async def logistics_order_ws(
    websocket: WebSocket,
    order_id: str,
    db: AsyncSession = Depends(get_db),
):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    try:
        user_id = decode_access_token(token)
    except ValueError:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user = await user_repo.get_by_id(db, user_id)
    if not user:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    order = await logistics_order_repo.get_by_id(db, order_id)
    if not order:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # Only active members of the order's own group may listen in — this is
    # the actual isolation boundary: it stops an unrelated, unauthorized user
    # from eavesdropping on a group's logistics traffic, room-keying alone
    # only stops *cross-order* leakage, not unauthorized access to this one.
    membership = await membership_repo.get_by_group_and_user(db, order.group_id, user.id)
    if not membership or membership.status != MembershipStatus.ACTIVE.value:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await logistics_ws_manager.connect(order_id, websocket)
    try:
        while True:
            # Clients don't need to send anything; this just waits for the
            # disconnect (or any keepalive ping the client cares to send).
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        logistics_ws_manager.disconnect(order_id, websocket)
