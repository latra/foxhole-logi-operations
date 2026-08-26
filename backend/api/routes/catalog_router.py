"""Catalog routes: Wars, Regions, Items, VehicleTypes."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies import get_current_user
from models.group import User
from repositories.catalog_repository import (
    item_repo,
    region_repo,
    vehicle_type_repo,
    war_repo,
)
from schemas.catalog import (
    ItemCreate,
    ItemResponse,
    ItemUpdate,
    RegionCreate,
    RegionResponse,
    RegionUpdate,
    VehicleTypeCreate,
    VehicleTypeResponse,
    VehicleTypeUpdate,
    WarCreate,
    WarResponse,
    WarUpdate,
)

router = APIRouter(tags=["catalog"], dependencies=[Depends(get_current_user)])

# ── Wars ─────────────────────────────────────────────────────────────────

war_router = APIRouter(prefix="/wars")


@war_router.get("", response_model=list[WarResponse])
async def list_wars(db: AsyncSession = Depends(get_db)):
    return await war_repo.list_all(db)


@war_router.get("/current", response_model=WarResponse)
async def get_current_war(db: AsyncSession = Depends(get_db)):
    war = await war_repo.get_current(db)
    if not war:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No current war found")
    return war


@war_router.get("/{war_id}", response_model=WarResponse)
async def get_war(war_id: int, db: AsyncSession = Depends(get_db)):
    war = await war_repo.get_by_id(db, war_id)
    if not war:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "War not found")
    return war


@war_router.post("", response_model=WarResponse, status_code=201)
async def create_war(body: WarCreate, db: AsyncSession = Depends(get_db)):
    war = await war_repo.create(db, **body.model_dump())
    await db.commit()
    return war


@war_router.patch("/{war_id}", response_model=WarResponse)
async def update_war(war_id: int, body: WarUpdate, db: AsyncSession = Depends(get_db)):
    war = await war_repo.update(db, war_id, **body.model_dump(exclude_unset=True))
    if not war:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "War not found")
    await db.commit()
    return war


@war_router.delete("/{war_id}", status_code=204)
async def delete_war(war_id: int, db: AsyncSession = Depends(get_db)):
    if not await war_repo.delete(db, war_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "War not found")
    await db.commit()


# ── Regions ──────────────────────────────────────────────────────────────

region_router = APIRouter(prefix="/regions")


@region_router.get("", response_model=list[RegionResponse])
async def list_regions(war_id: int | None = None, db: AsyncSession = Depends(get_db)):
    if war_id is not None:
        return await region_repo.list_by_war(db, war_id)
    return await region_repo.list_all(db)


@region_router.get("/{region_id}", response_model=RegionResponse)
async def get_region(region_id: int, db: AsyncSession = Depends(get_db)):
    region = await region_repo.get_by_id(db, region_id)
    if not region:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Region not found")
    return region


@region_router.post("", response_model=RegionResponse, status_code=201)
async def create_region(body: RegionCreate, db: AsyncSession = Depends(get_db)):
    region = await region_repo.create(db, **body.model_dump())
    await db.commit()
    return region


@region_router.patch("/{region_id}", response_model=RegionResponse)
async def update_region(
    region_id: int, body: RegionUpdate, db: AsyncSession = Depends(get_db)
):
    region = await region_repo.update(db, region_id, **body.model_dump(exclude_unset=True))
    if not region:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Region not found")
    await db.commit()
    return region


@region_router.delete("/{region_id}", status_code=204)
async def delete_region(region_id: int, db: AsyncSession = Depends(get_db)):
    if not await region_repo.delete(db, region_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Region not found")
    await db.commit()


# ── Items ────────────────────────────────────────────────────────────────

item_router = APIRouter(prefix="/items")


@item_router.get("", response_model=list[ItemResponse])
async def list_items(db: AsyncSession = Depends(get_db)):
    return await item_repo.list_all(db, limit=10_000)


@item_router.get("/{item_id}", response_model=ItemResponse)
async def get_item(item_id: int, db: AsyncSession = Depends(get_db)):
    item = await item_repo.get_by_id(db, item_id)
    if not item:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Item not found")
    return item


@item_router.post("", response_model=ItemResponse, status_code=201)
async def create_item(body: ItemCreate, db: AsyncSession = Depends(get_db)):
    item = await item_repo.create(db, **body.model_dump())
    await db.commit()
    return item


@item_router.patch("/{item_id}", response_model=ItemResponse)
async def update_item(
    item_id: int, body: ItemUpdate, db: AsyncSession = Depends(get_db)
):
    item = await item_repo.update(db, item_id, **body.model_dump(exclude_unset=True))
    if not item:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Item not found")
    await db.commit()
    return item


@item_router.delete("/{item_id}", status_code=204)
async def delete_item(item_id: int, db: AsyncSession = Depends(get_db)):
    if not await item_repo.delete(db, item_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Item not found")
    await db.commit()


# ── VehicleTypes ─────────────────────────────────────────────────────────

vehicle_type_router = APIRouter(prefix="/vehicle-types")


@vehicle_type_router.get("", response_model=list[VehicleTypeResponse])
async def list_vehicle_types(db: AsyncSession = Depends(get_db)):
    return await vehicle_type_repo.list_all(db, limit=10_000)


@vehicle_type_router.get("/{vt_id}", response_model=VehicleTypeResponse)
async def get_vehicle_type(vt_id: int, db: AsyncSession = Depends(get_db)):
    vt = await vehicle_type_repo.get_by_id(db, vt_id)
    if not vt:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Vehicle type not found")
    return vt


@vehicle_type_router.post("", response_model=VehicleTypeResponse, status_code=201)
async def create_vehicle_type(
    body: VehicleTypeCreate, db: AsyncSession = Depends(get_db)
):
    vt = await vehicle_type_repo.create(db, **body.model_dump())
    await db.commit()
    return vt


@vehicle_type_router.patch("/{vt_id}", response_model=VehicleTypeResponse)
async def update_vehicle_type(
    vt_id: int, body: VehicleTypeUpdate, db: AsyncSession = Depends(get_db)
):
    vt = await vehicle_type_repo.update(db, vt_id, **body.model_dump(exclude_unset=True))
    if not vt:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Vehicle type not found")
    await db.commit()
    return vt


@vehicle_type_router.delete("/{vt_id}", status_code=204)
async def delete_vehicle_type(vt_id: int, db: AsyncSession = Depends(get_db)):
    if not await vehicle_type_repo.delete(db, vt_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Vehicle type not found")
    await db.commit()


# Register sub-routers
router.include_router(war_router)
router.include_router(region_router)
router.include_router(item_router)
router.include_router(vehicle_type_router)
