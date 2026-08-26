"""Operation, group-invite, and signup routes."""

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import AsyncSessionLocal, get_db
from dependencies import get_current_user, get_user_from_token
from models.group import Group, GroupMembership, User
from models.enums import MembershipRole, MembershipStatus
from models.operation import OperationGroupInvite
from repositories.group_repository import membership_repo
from repositories.operation_repository import operation_repo, invite_repo, signup_repo
from schemas.operation import (
    OperationCreate,
    OperationResponse,
    OperationInviteCreate,
    OperationGroupInviteResponse,
    OperationSignupCreate,
    OperationSignupResponse,
    OperationSignupUpdate,
    OperationUpdate,
    InvitedGroupInfo,
    PlanShape,
)
from schemas.group import GroupResponse
from services.operation_plan_hub import plan_hub
from ws_manager import operations_ws_manager

router = APIRouter(prefix="/operations", tags=["operations"])


# ── Helpers ─────────────────────────────────────────────────────────────

_OFFICER_ROLES = {MembershipRole.OWNER.value, MembershipRole.OFFICER.value}


async def _require_officer(db: AsyncSession, user_id: str, group_id: str) -> GroupMembership:
    """Return the membership if the user is an OFFICER or OWNER; else 403."""
    m = await membership_repo.get_by_group_and_user(db, group_id, user_id)
    if not m or m.status != MembershipStatus.ACTIVE.value or m.role not in _OFFICER_ROLES:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Only Officers or Owners of the group can perform this action.",
        )
    return m


async def _user_group_ids(db: AsyncSession, user_id: str) -> list[str]:
    """Return group IDs where the user has an active membership."""
    result = await db.execute(
        select(GroupMembership.group_id).where(
            GroupMembership.user_id == user_id,
            GroupMembership.status == MembershipStatus.ACTIVE.value,
        )
    )
    return [row[0] for row in result.all()]


async def _invited_group_ids(db: AsyncSession, operation_id: str) -> list[str]:
    """Group IDs invited to an operation (includes the creator's group)."""
    return [inv.group_id for inv in await invite_repo.list_by_operation(db, operation_id)]


async def _broadcast_operation_event(db: AsyncSession, operation_id: str, group_id: str) -> None:
    """Notify everyone who can see this operation (its creator group plus
    any invited groups) that it changed — created, updated, cancelled,
    invited/uninvited, or deleted. The client just refetches on receipt."""
    group_ids = await _invited_group_ids(db, operation_id)
    if group_id not in group_ids:
        group_ids = [*group_ids, group_id]
    await operations_ws_manager.broadcast_to_groups(
        group_ids, {"event": "operation_changed", "operation_id": operation_id}
    )


async def _can_manage_operation(db: AsyncSession, user_id: str, invited_group_ids: list[str]) -> bool:
    """True if the user is an ACTIVE OWNER/OFFICER in any invited group.

    Used both to gate editing an operation's own details and to gate
    editing its live plan — any officer/owner of a group involved in the
    operation (creator or invited) can manage it, not just the creator
    group's officers."""
    for gid in invited_group_ids:
        m = await membership_repo.get_by_group_and_user(db, gid, user_id)
        if m and m.status == MembershipStatus.ACTIVE.value and m.role in _OFFICER_ROLES:
            return True
    return False


def _build_response(op) -> dict:
    """Build the OperationResponse dict with invited_groups info."""
    invited = []
    for inv in (op.invited_groups or []):
        if inv.group:
            invited.append(InvitedGroupInfo(
                id=inv.group.id,
                name=inv.group.name,
                tag=inv.group.tag,
                faction=inv.group.faction,
            ))
    data = {c.key: getattr(op, c.key) for c in op.__table__.columns}
    data["invited_groups"] = invited
    return data


# ── Group search by faction ────────────────────────────────────────────

@router.get(
    "/groups/search",
    response_model=list[GroupResponse],
    summary="Search groups by faction (for inviting to operations)",
)
async def search_groups_by_faction(
    faction: str = Query(..., description="WARDEN or COLONIAL"),
    q: str = Query("", description="Optional name/tag search"),
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    stmt = select(Group).where(Group.faction == faction.upper())
    if q.strip():
        pattern = f"%{q.strip()}%"
        stmt = stmt.where(Group.name.ilike(pattern) | Group.tag.ilike(pattern))
    stmt = stmt.order_by(Group.name).limit(50)
    result = await db.execute(stmt)
    return list(result.scalars().all())


# ── Operations CRUD ────────────────────────────────────────────────────

@router.get("", response_model=list[OperationResponse])
async def list_operations(
    group_id: str | None = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List operations visible to the current user.

    If group_id is provided, returns ops for that group.
    Otherwise returns all ops where the user's groups are creator or invited.
    """
    if group_id:
        ops = await operation_repo.list_by_group(db, group_id, offset=offset, limit=limit)
    else:
        my_groups = await _user_group_ids(db, current_user.id)
        if not my_groups:
            return []
        ops = await operation_repo.list_visible_to_groups(
            db, my_groups, offset=offset, limit=limit
        )
    return [_build_response(op) for op in ops]


@router.get("/{operation_id}", response_model=OperationResponse)
async def get_operation(
    operation_id: str,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    op = await operation_repo.get_with_invites(db, operation_id)
    if not op:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Operation not found")
    return _build_response(op)


@router.post("", response_model=OperationResponse, status_code=201)
async def create_operation(
    body: OperationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Only Officers/Owners of the creator group can create
    await _require_officer(db, current_user.id, body.group_id)

    op = await operation_repo.create(
        db,
        group_id=body.group_id,
        war_id=body.war_id,
        name=body.name,
        description=body.description,
        scheduled_at=body.scheduled_at,
        duration_minutes=body.duration_minutes,
        region_id=body.region_id,
        location_detail=body.location_detail,
        created_by=current_user.id,
        plan_shapes=[s.model_dump() for s in body.plan_shapes] if body.plan_shapes else None,
    )

    # The creator's own group is always implicitly invited
    await invite_repo.create(db, operation_id=op.id, group_id=body.group_id)

    # Invite additional groups (must be same faction)
    if body.invited_group_ids:
        creator_group = await db.get(Group, body.group_id)
        for gid in body.invited_group_ids:
            if gid == body.group_id:
                continue  # already added
            target = await db.get(Group, gid)
            if not target or target.faction != creator_group.faction:
                continue  # silently skip cross-faction or invalid
            await invite_repo.create(db, operation_id=op.id, group_id=gid)

    await db.commit()
    await _broadcast_operation_event(db, op.id, op.group_id)

    # Re-fetch with invites loaded
    op = await operation_repo.get_with_invites(db, op.id)
    return _build_response(op)


@router.patch("/{operation_id}", response_model=OperationResponse)
async def update_operation(
    operation_id: str,
    body: OperationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    op = await operation_repo.get_by_id(db, operation_id)
    if not op:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Operation not found")

    invited_group_ids = await _invited_group_ids(db, operation_id)
    if not await _can_manage_operation(db, current_user.id, invited_group_ids):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Only Officers or Owners of an invited group can edit this operation.",
        )

    data = body.model_dump(exclude_unset=True)
    if "status" in data and data["status"] is not None:
        data["status"] = data["status"].value
    op = await operation_repo.update(db, operation_id, **data)
    await db.commit()
    await _broadcast_operation_event(db, op.id, op.group_id)

    op = await operation_repo.get_with_invites(db, op.id)
    return _build_response(op)


@router.delete("/{operation_id}", status_code=204)
async def delete_operation(
    operation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    op = await operation_repo.get_by_id(db, operation_id)
    if not op:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Operation not found")
    await _require_officer(db, current_user.id, op.group_id)

    # Capture before delete — invites cascade-delete with the operation, so
    # they wouldn't be there to look up afterward.
    group_ids = await _invited_group_ids(db, operation_id)
    if op.group_id not in group_ids:
        group_ids = [*group_ids, op.group_id]

    if not await operation_repo.delete(db, operation_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Operation not found")
    await db.commit()
    await operations_ws_manager.broadcast_to_groups(
        group_ids, {"event": "operation_changed", "operation_id": operation_id}
    )


# ── Group invites ──────────────────────────────────────────────────────

@router.post(
    "/{operation_id}/invites",
    response_model=list[OperationGroupInviteResponse],
    status_code=201,
)
async def add_invites(
    operation_id: str,
    body: OperationInviteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    op = await operation_repo.get_by_id(db, operation_id)
    if not op:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Operation not found")
    await _require_officer(db, current_user.id, op.group_id)

    creator_group = await db.get(Group, op.group_id)
    created = []
    for gid in body.group_ids:
        target = await db.get(Group, gid)
        if not target or target.faction != creator_group.faction:
            continue
        # Check for existing invite
        existing = await db.execute(
            select(OperationGroupInvite).where(
                OperationGroupInvite.operation_id == operation_id,
                OperationGroupInvite.group_id == gid,
            )
        )
        if existing.scalar_one_or_none():
            continue
        inv = await invite_repo.create(db, operation_id=operation_id, group_id=gid)
        created.append(inv)
    await db.commit()
    await _broadcast_operation_event(db, operation_id, op.group_id)
    return created


@router.get(
    "/{operation_id}/invites",
    response_model=list[OperationGroupInviteResponse],
)
async def list_invites(
    operation_id: str,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return await invite_repo.list_by_operation(db, operation_id)


@router.delete("/{operation_id}/invites/{group_id}", status_code=204)
async def remove_invite(
    operation_id: str,
    group_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    op = await operation_repo.get_by_id(db, operation_id)
    if not op:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Operation not found")
    await _require_officer(db, current_user.id, op.group_id)

    # Capture before removal so the group losing access still hears about it.
    notify_group_ids = await _invited_group_ids(db, operation_id)
    if op.group_id not in notify_group_ids:
        notify_group_ids = [*notify_group_ids, op.group_id]

    if not await invite_repo.delete_by_operation_and_group(db, operation_id, group_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invite not found")
    await db.commit()
    await operations_ws_manager.broadcast_to_groups(
        notify_group_ids, {"event": "operation_changed", "operation_id": operation_id}
    )


# ── Signups ────────────────────────────────────────────────────────────

@router.get("/{operation_id}/signups", response_model=list[OperationSignupResponse])
async def list_signups(
    operation_id: str,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    signups = await signup_repo.list_by_operation(db, operation_id)
    return [
        OperationSignupResponse(
            id=s.id,
            operation_id=s.operation_id,
            user_id=s.user_id,
            status=s.status,
            signed_up_at=s.signed_up_at,
            updated_at=s.updated_at,
            user={
                "id": s.user.id,
                "display_name": s.user.display_name,
                "avatar_url": s.user.avatar_url,
            } if s.user else None,
        )
        for s in signups
    ]


@router.post("/{operation_id}/signups", response_model=OperationSignupResponse, status_code=201)
async def create_signup(
    operation_id: str,
    body: OperationSignupCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify the operation exists
    op = await operation_repo.get_by_id(db, operation_id)
    if not op:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Operation not found")

    # Verify user belongs to an invited group
    user_groups = await _user_group_ids(db, current_user.id)
    invited_group_ids = await _invited_group_ids(db, operation_id)
    if not any(gid in invited_group_ids for gid in user_groups):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Your group is not invited to this operation.",
        )

    existing = await signup_repo.get_by_operation_and_user(db, operation_id, current_user.id)
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Already signed up")

    signup = await signup_repo.create(
        db,
        operation_id=operation_id,
        user_id=current_user.id,
        status=body.status.value,
    )
    await db.commit()
    await operations_ws_manager.broadcast_to_groups(
        invited_group_ids, {"event": "operation_changed", "operation_id": operation_id}
    )

    # Re-fetch with user loaded
    signup = await signup_repo.get_by_operation_and_user(db, operation_id, current_user.id)
    return OperationSignupResponse(
        id=signup.id,
        operation_id=signup.operation_id,
        user_id=signup.user_id,
        status=signup.status,
        signed_up_at=signup.signed_up_at,
        updated_at=signup.updated_at,
    )


@router.patch("/{operation_id}/signups/{signup_id}", response_model=OperationSignupResponse)
async def update_signup(
    operation_id: str,
    signup_id: str,
    body: OperationSignupUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = body.model_dump(exclude_unset=True)
    if "status" in data and data["status"] is not None:
        data["status"] = data["status"].value
    signup = await signup_repo.update(db, signup_id, **data)
    if not signup:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Signup not found")
    await db.commit()
    await operations_ws_manager.broadcast_to_groups(
        await _invited_group_ids(db, operation_id),
        {"event": "operation_changed", "operation_id": operation_id},
    )
    return signup


@router.delete("/{operation_id}/signups/{signup_id}", status_code=204)
async def delete_signup(
    operation_id: str,
    signup_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not await signup_repo.delete(db, signup_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Signup not found")
    await db.commit()
    await operations_ws_manager.broadcast_to_groups(
        await _invited_group_ids(db, operation_id),
        {"event": "operation_changed", "operation_id": operation_id},
    )


# ── Live operations list (WebSocket) ─────────────────────────────────────
#
# One connection per user session on the Operations page — joined into a
# room per ACTIVE group membership at connect time. Any operation create /
# update (including cancel) / delete / invite change is broadcast to the
# rooms of every group that can see that operation, so the list and any
# open detail view refresh themselves without an F5. The client is expected
# to send a `{"kind": "ping"}` roughly every 20s; this keeps the socket
# alive through idle-connection timeouts and, if the client stops hearing
# a `pong` back, it treats the connection as dead and reconnects.

@router.websocket("/ws")
async def operations_ws(websocket: WebSocket, token: str = Query(...)):
    async with AsyncSessionLocal() as db:
        user = await get_user_from_token(token, db)
        if not user:
            await websocket.close(code=1008)
            return

        group_ids = await _user_group_ids(db, user.id)

        await operations_ws_manager.connect(group_ids, websocket)
        try:
            while True:
                msg = await websocket.receive_json()
                if msg.get("kind") == "ping":
                    await websocket.send_json({"kind": "pong"})
        except WebSocketDisconnect:
            pass
        finally:
            operations_ws_manager.disconnect(websocket)


# ── Live operation plan (WebSocket) ─────────────────────────────────────
#
# Anyone with an ACTIVE membership in an invited group may view; only an
# OWNER/OFFICER in one of those groups may edit. The hub keeps an in-memory
# authoritative shape list per operation and persists on every mutation.

@router.websocket("/{operation_id}/plan/ws")
async def plan_ws(websocket: WebSocket, operation_id: str, token: str = Query(...)):
    async with AsyncSessionLocal() as db:
        user = await get_user_from_token(token, db)
        if not user:
            await websocket.close(code=1008)
            return

        op = await operation_repo.get_with_invites(db, operation_id)
        if not op:
            await websocket.close(code=1008)
            return

        invited_group_ids = [inv.group_id for inv in (op.invited_groups or [])]
        user_group_ids = await _user_group_ids(db, user.id)
        if not any(gid in invited_group_ids for gid in user_group_ids):
            await websocket.close(code=1008)
            return

        can_edit = await _can_manage_operation(db, user.id, invited_group_ids)

        await websocket.accept()
        plan_hub.join(operation_id, websocket)
        try:
            shapes = plan_hub.get_state(operation_id, op.plan_shapes)
            await websocket.send_json({"kind": "full-state", "shapes": shapes})

            while True:
                msg = await websocket.receive_json()
                kind = msg.get("kind")

                if kind not in ("shape-add", "shape-update", "shape-remove", "undo", "clear-all"):
                    continue

                if not can_edit:
                    await websocket.send_json(
                        {"kind": "error", "message": "You don't have permission to edit this plan."}
                    )
                    continue

                if kind == "shape-add":
                    try:
                        shape = PlanShape(**msg["shape"]).model_dump()
                    except Exception:
                        continue
                    shapes.append(shape)
                elif kind == "shape-update":
                    try:
                        shape = PlanShape(**msg["shape"]).model_dump()
                    except Exception:
                        continue
                    for i, s in enumerate(shapes):
                        if s["id"] == shape["id"]:
                            shapes[i] = shape
                            break
                    else:
                        continue
                elif kind in ("shape-remove", "undo"):
                    shape_id = msg.get("shapeId")
                    shapes[:] = [s for s in shapes if s["id"] != shape_id]
                elif kind == "clear-all":
                    shapes.clear()

                op.plan_shapes = list(shapes)
                await db.commit()
                await plan_hub.broadcast(operation_id, msg, exclude=websocket)
        except WebSocketDisconnect:
            pass
        finally:
            plan_hub.leave(operation_id, websocket)
