"""Transport routes: TransportRun, TransportCargo."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies import get_current_user
from repositories.transport_repository import transport_cargo_repo, transport_run_repo
from schemas.transport import (
    TransportCargoCreate,
    TransportCargoResponse,
    TransportCargoUpdate,
    TransportRunCreate,
    TransportRunResponse,
    TransportRunUpdate,
)

router = APIRouter(prefix="/transport-runs", tags=["transport"], dependencies=[Depends(get_current_user)])


# ── TransportRun ─────────────────────────────────────────────────────────

@router.get("", response_model=list[TransportRunResponse])
async def list_transport_runs(
    order_id: str | None = Query(None),
    driver_id: str | None = Query(None),
    run_status: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
):
    if order_id:
        return await transport_run_repo.list_by_order(db, order_id)
    if driver_id:
        return await transport_run_repo.list_by_driver(db, driver_id, status=run_status)
    return await transport_run_repo.list_all(db, filters={"status": run_status})


@router.get("/{run_id}", response_model=TransportRunResponse)
async def get_transport_run(run_id: str, db: AsyncSession = Depends(get_db)):
    run = await transport_run_repo.get_by_id(db, run_id)
    if not run:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Transport run not found")
    return run


@router.post("", response_model=TransportRunResponse, status_code=201)
async def create_transport_run(
    body: TransportRunCreate, db: AsyncSession = Depends(get_db)
):
    run = await transport_run_repo.create(db, **body.model_dump())
    await db.commit()
    return run


@router.patch("/{run_id}", response_model=TransportRunResponse)
async def update_transport_run(
    run_id: str, body: TransportRunUpdate, db: AsyncSession = Depends(get_db)
):
    data = body.model_dump(exclude_unset=True)
    if "status" in data and data["status"] is not None:
        data["status"] = data["status"].value
    run = await transport_run_repo.update(db, run_id, **data)
    if not run:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Transport run not found")
    await db.commit()
    return run


@router.delete("/{run_id}", status_code=204)
async def delete_transport_run(run_id: str, db: AsyncSession = Depends(get_db)):
    if not await transport_run_repo.delete(db, run_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Transport run not found")
    await db.commit()


# ── TransportCargo ───────────────────────────────────────────────────────

@router.get("/{run_id}/cargo", response_model=list[TransportCargoResponse])
async def list_cargo(run_id: str, db: AsyncSession = Depends(get_db)):
    return await transport_cargo_repo.list_by_run(db, run_id)


@router.post("/{run_id}/cargo", response_model=TransportCargoResponse, status_code=201)
async def create_cargo(
    run_id: str, body: TransportCargoCreate, db: AsyncSession = Depends(get_db)
):
    cargo = await transport_cargo_repo.create(
        db,
        transport_run_id=run_id,
        resource_request_id=body.resource_request_id,
        quantity_crates=body.quantity_crates,
    )
    await db.commit()
    return cargo


@router.patch("/{run_id}/cargo/{cargo_id}", response_model=TransportCargoResponse)
async def update_cargo(
    run_id: str,
    cargo_id: str,
    body: TransportCargoUpdate,
    db: AsyncSession = Depends(get_db),
):
    cargo = await transport_cargo_repo.update(
        db, cargo_id, **body.model_dump(exclude_unset=True)
    )
    if not cargo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Transport cargo not found")
    await db.commit()
    return cargo


@router.delete("/{run_id}/cargo/{cargo_id}", status_code=204)
async def delete_cargo(
    run_id: str, cargo_id: str, db: AsyncSession = Depends(get_db)
):
    if not await transport_cargo_repo.delete(db, cargo_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Transport cargo not found")
    await db.commit()
