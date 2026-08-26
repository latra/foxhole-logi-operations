"""Stockpile routes."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies import get_current_user
from models.enums import MembershipRole, MembershipStatus
from models.group import User
from repositories.group_repository import membership_repo
from repositories.stockpile_repository import stockpile_repo
from schemas.stockpile import StockpileCreate, StockpileResponse, StockpileUpdate

router = APIRouter(prefix="/stockpiles", tags=["stockpiles"], dependencies=[Depends(get_current_user)])


# ── Helpers ─────────────────────────────────────────────────────────────

_OFFICER_ROLES = {MembershipRole.OWNER.value, MembershipRole.OFFICER.value}


async def _require_member(db: AsyncSession, user_id: str, group_id: str):
    """Return the membership if the user is an ACTIVE member of the group; else 403."""
    m = await membership_repo.get_by_group_and_user(db, group_id, user_id)
    if not m or m.status != MembershipStatus.ACTIVE.value:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "You must be an active member of this group.",
        )
    return m


async def _require_officer(db: AsyncSession, user_id: str, group_id: str):
    """Return the membership if the user is an OFFICER or OWNER; else 403."""
    m = await _require_member(db, user_id, group_id)
    if m.role not in _OFFICER_ROLES:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Only Officers or Owners of the group can perform this action.",
        )
    return m


# ── Routes ──────────────────────────────────────────────────────────────

@router.get("", response_model=list[StockpileResponse])
async def list_stockpiles(
    group_id: str | None = Query(None),
    war_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if group_id:
        await _require_member(db, current_user.id, group_id)
    if group_id and war_id:
        return await stockpile_repo.list_by_group_and_war(db, group_id, war_id)
    return await stockpile_repo.list_all(db, filters={"group_id": group_id, "war_id": war_id})


@router.get("/{stockpile_id}", response_model=StockpileResponse)
async def get_stockpile(
    stockpile_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    s = await stockpile_repo.get_by_id(db, stockpile_id)
    if not s:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Stockpile not found")
    await _require_member(db, current_user.id, s.group_id)
    return s


@router.post("", response_model=StockpileResponse, status_code=201)
async def create_stockpile(
    body: StockpileCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Any active member of the group may create a stockpile
    await _require_member(db, current_user.id, body.group_id)
    s = await stockpile_repo.create(db, **body.model_dump())
    await db.commit()
    return s


@router.patch("/{stockpile_id}", response_model=StockpileResponse)
async def update_stockpile(
    stockpile_id: str,
    body: StockpileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = await stockpile_repo.get_by_id(db, stockpile_id)
    if not existing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Stockpile not found")
    await _require_member(db, current_user.id, existing.group_id)

    s = await stockpile_repo.update(db, stockpile_id, **body.model_dump(exclude_unset=True))
    await db.commit()
    return s


@router.delete("/{stockpile_id}", status_code=204)
async def delete_stockpile(
    stockpile_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a stockpile (Officer or Owner of the group only)."""
    existing = await stockpile_repo.get_by_id(db, stockpile_id)
    if not existing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Stockpile not found")
    await _require_officer(db, current_user.id, existing.group_id)

    await stockpile_repo.delete(db, stockpile_id)
    await db.commit()
