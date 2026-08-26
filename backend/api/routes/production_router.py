"""ProductionTask routes."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies import get_current_user
from repositories.production_repository import production_task_repo
from schemas.production import (
    ProductionTaskCreate,
    ProductionTaskResponse,
    ProductionTaskUpdate,
)

router = APIRouter(prefix="/production-tasks", tags=["production"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[ProductionTaskResponse])
async def list_production_tasks(
    order_id: str | None = Query(None),
    assignee_id: str | None = Query(None),
    task_status: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
):
    if order_id:
        return await production_task_repo.list_by_order(db, order_id)
    if assignee_id:
        return await production_task_repo.list_by_assignee(db, assignee_id, status=task_status)
    return await production_task_repo.list_all(db, filters={"status": task_status})


@router.get("/{task_id}", response_model=ProductionTaskResponse)
async def get_production_task(task_id: str, db: AsyncSession = Depends(get_db)):
    task = await production_task_repo.get_by_id(db, task_id)
    if not task:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Production task not found")
    return task


@router.post("", response_model=ProductionTaskResponse, status_code=201)
async def create_production_task(
    body: ProductionTaskCreate, db: AsyncSession = Depends(get_db)
):
    task = await production_task_repo.create(db, **body.model_dump())
    await db.commit()
    return task


@router.patch("/{task_id}", response_model=ProductionTaskResponse)
async def update_production_task(
    task_id: str, body: ProductionTaskUpdate, db: AsyncSession = Depends(get_db)
):
    data = body.model_dump(exclude_unset=True)
    if "status" in data and data["status"] is not None:
        data["status"] = data["status"].value
    task = await production_task_repo.update(db, task_id, **data)
    if not task:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Production task not found")
    await db.commit()
    return task


@router.delete("/{task_id}", status_code=204)
async def delete_production_task(task_id: str, db: AsyncSession = Depends(get_db)):
    if not await production_task_repo.delete(db, task_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Production task not found")
    await db.commit()
