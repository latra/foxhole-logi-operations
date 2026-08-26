"""FastAPI application entry point."""

import asyncio
import logging
from contextlib import asynccontextmanager

import fastapi
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from models import Base  # noqa: F401 — ensures all models are registered
from services.war_sync_service import sync_war

from routes.auth_router import router as auth_router
from routes.catalog_router import router as catalog_router
from routes.group_router import router as group_router
from routes.stockpile_router import router as stockpile_router
from routes.operation_router import router as operation_router
from routes.logistics_router import router as logistics_router
from routes.logistics_router import ws_router as logistics_ws_router
from routes.production_router import router as production_router
from routes.transport_router import router as transport_router
from routes.audit_router import router as audit_router
from routes.map_router import router as map_router

logger = logging.getLogger(__name__)

# Sync interval: 24 hours in seconds
WAR_SYNC_INTERVAL = 24 * 60 * 60


async def _war_sync_loop() -> None:
    """Background loop that syncs war data from the Foxhole API.

    Runs immediately on startup, then every 24 hours.
    """
    while True:
        try:
            await sync_war()
        except Exception:
            logger.exception("War sync background task failed — will retry next cycle")
        await asyncio.sleep(WAR_SYNC_INTERVAL)


@asynccontextmanager
async def lifespan(app: fastapi.FastAPI):
    # Schema is owned by Alembic migrations now (see backend/alembic/) — run
    # `alembic upgrade head` as a deploy step. This used to also call
    # Base.metadata.create_all() here, which raced/conflicted with Alembic's
    # tracking once real migrations existed (duplicate-table errors on boot).
    # Start background war sync task
    logger.error("Starting war sync background task")
    sync_task = asyncio.create_task(_war_sync_loop())
    logger.error("War sync background task started (interval: %ds)", WAR_SYNC_INTERVAL)

    yield

    # Cancel the background task on shutdown
    sync_task.cancel()
    try:
        await sync_task
    except asyncio.CancelledError:
        logger.info("War sync background task stopped")


app = fastapi.FastAPI(title=settings.app.name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all routers
app.include_router(auth_router)
app.include_router(catalog_router)
app.include_router(group_router)
app.include_router(stockpile_router)
app.include_router(operation_router)
app.include_router(logistics_router)
app.include_router(logistics_ws_router)
app.include_router(production_router)
app.include_router(transport_router)
app.include_router(audit_router)
app.include_router(map_router)


@app.get("/")
def read_root():
    return {"status": "ok", "app": settings.app.name}
