"""Group and GroupMembership routes."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies import get_current_user
from models.group import User
from models.enums import MembershipRole, MembershipStatus
from repositories.group_repository import group_repo, membership_repo
from schemas.group import (
    GroupCreate,
    GroupMembershipResponse,
    GroupMembershipUpdate,
    GroupResponse,
    GroupUpdate,
    MemberUserInfo,
)

router = APIRouter(prefix="/groups", tags=["groups"], dependencies=[Depends(get_current_user)])


# ── Helpers ─────────────────────────────────────────────────────────────

_OWNER_ROLES = {MembershipRole.OWNER.value}
_OFFICER_ROLES = {MembershipRole.OWNER.value, MembershipRole.OFFICER.value}


def _membership_with_user(m) -> dict:
    """Build a GroupMembershipResponse dict including the user info."""
    user_info = None
    if m.user:
        user_info = MemberUserInfo(
            id=m.user.id,
            display_name=m.user.display_name,
            username=m.user.username,
            avatar_url=m.user.avatar_url,
        )
    return {
        "id": m.id,
        "group_id": m.group_id,
        "user_id": m.user_id,
        "role": m.role,
        "status": m.status,
        "joined_at": m.joined_at,
        "left_at": m.left_at,
        "user": user_info,
    }


# ── Groups CRUD ─────────────────────────────────────────────────────────

@router.get("", response_model=list[GroupResponse])
async def list_groups(db: AsyncSession = Depends(get_db)):
    return await group_repo.list_all(db)


@router.get("/{group_id}", response_model=GroupResponse)
async def get_group(group_id: str, db: AsyncSession = Depends(get_db)):
    group = await group_repo.get_by_id(db, group_id)
    if not group:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Group not found")
    return group


@router.post("", response_model=GroupResponse, status_code=201)
async def create_group(
    body: GroupCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    group = await group_repo.create(db, **body.model_dump())
    # Auto-assign the creator as OWNER with ACTIVE status
    await membership_repo.create(
        db,
        group_id=group.id,
        user_id=current_user.id,
        role=MembershipRole.OWNER.value,
        status=MembershipStatus.ACTIVE.value,
    )
    await db.commit()
    return group


@router.patch("/{group_id}", response_model=GroupResponse)
async def update_group(
    group_id: str, body: GroupUpdate, db: AsyncSession = Depends(get_db)
):
    group = await group_repo.update(db, group_id, **body.model_dump(exclude_unset=True))
    if not group:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Group not found")
    await db.commit()
    return group


@router.delete("/{group_id}", status_code=204)
async def delete_group(
    group_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a group (Owner only)."""
    caller = await membership_repo.get_by_group_and_user(db, group_id, current_user.id)
    if not caller or caller.role not in _OWNER_ROLES or caller.status != MembershipStatus.ACTIVE.value:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the group Owner can delete the group.")
    if not await group_repo.delete(db, group_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Group not found")
    await db.commit()


# ── Memberships ──────────────────────────────────────────────────────────

@router.get("/{group_id}/members", response_model=list[GroupMembershipResponse])
async def list_members(
    group_id: str,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """List all active + pending members with user info."""
    members = await membership_repo.list_all_members(db, group_id)
    return [_membership_with_user(m) for m in members]


@router.post("/{group_id}/members", response_model=GroupMembershipResponse, status_code=201)
async def request_join(
    group_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Request to join a group (creates a PENDING membership)."""
    existing = await membership_repo.get_by_group_and_user(db, group_id, current_user.id)
    if existing:
        if existing.status == MembershipStatus.ACTIVE.value:
            raise HTTPException(status.HTTP_409_CONFLICT, "Already a member")
        if existing.status == MembershipStatus.PENDING.value:
            raise HTTPException(status.HTTP_409_CONFLICT, "Join request already pending")
        # If REMOVED or INACTIVE, allow re-request
        existing.status = MembershipStatus.PENDING.value
        existing.left_at = None
        await db.flush()
        await db.commit()
        return existing

    membership = await membership_repo.create(
        db,
        group_id=group_id,
        user_id=current_user.id,
        role=MembershipRole.MEMBER.value,
        status=MembershipStatus.PENDING.value,
    )
    await db.commit()
    return membership


@router.post(
    "/{group_id}/members/{membership_id}/accept",
    response_model=GroupMembershipResponse,
)
async def accept_member(
    group_id: str,
    membership_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Accept a pending join request (Owner or Officer)."""
    caller = await membership_repo.get_by_group_and_user(db, group_id, current_user.id)
    if not caller or caller.role not in _OFFICER_ROLES or caller.status != MembershipStatus.ACTIVE.value:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only Officers or the Owner can accept requests.")

    membership = await membership_repo.get_by_id(db, membership_id)
    if not membership or membership.group_id != group_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Membership not found")
    if membership.status != MembershipStatus.PENDING.value:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Membership is not pending")

    membership.status = MembershipStatus.ACTIVE.value
    await db.flush()
    await db.commit()
    # Re-fetch with user relationship loaded for serialisation
    loaded = await membership_repo.get_with_user(db, membership_id)
    return _membership_with_user(loaded)


@router.post(
    "/{group_id}/members/{membership_id}/reject",
    status_code=204,
)
async def reject_member(
    group_id: str,
    membership_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reject a pending join request (Owner or Officer). Deletes the record."""
    caller = await membership_repo.get_by_group_and_user(db, group_id, current_user.id)
    if not caller or caller.role not in _OFFICER_ROLES or caller.status != MembershipStatus.ACTIVE.value:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only Officers or the Owner can reject requests.")

    membership = await membership_repo.get_by_id(db, membership_id)
    if not membership or membership.group_id != group_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Membership not found")
    if membership.status != MembershipStatus.PENDING.value:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Membership is not pending")

    await db.delete(membership)
    await db.commit()


@router.delete("/{group_id}/members/{membership_id}", status_code=204)
async def remove_member(
    group_id: str,
    membership_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a member from the group (Owner only). Cannot remove self."""
    caller = await membership_repo.get_by_group_and_user(db, group_id, current_user.id)
    if not caller or caller.role not in _OWNER_ROLES or caller.status != MembershipStatus.ACTIVE.value:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the group Owner can remove members.")

    membership = await membership_repo.get_by_id(db, membership_id)
    if not membership or membership.group_id != group_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Membership not found")
    if membership.user_id == current_user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot remove yourself")

    membership.status = MembershipStatus.REMOVED.value
    membership.left_at = datetime.now(timezone.utc)
    await db.flush()
    await db.commit()


@router.patch(
    "/{group_id}/members/{membership_id}",
    response_model=GroupMembershipResponse,
)
async def update_membership(
    group_id: str,
    membership_id: str,
    body: GroupMembershipUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a membership role/status (Owner only)."""
    caller = await membership_repo.get_by_group_and_user(db, group_id, current_user.id)
    if not caller or caller.role not in _OWNER_ROLES or caller.status != MembershipStatus.ACTIVE.value:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the group Owner can change member roles.")

    data = body.model_dump(exclude_unset=True)
    if "role" in data and data["role"] is not None:
        data["role"] = data["role"].value
    if "status" in data and data["status"] is not None:
        data["status"] = data["status"].value

    membership = await membership_repo.update(db, membership_id, **data)
    if not membership or membership.group_id != group_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Membership not found")
    await db.commit()
    loaded = await membership_repo.get_with_user(db, membership_id)
    return _membership_with_user(loaded)
