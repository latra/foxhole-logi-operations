"""Service to sync war data from the Foxhole War API.

Fetches the current war status and available map regions from the
official Foxhole API, then upserts the war record and creates any
missing regions in the local database.

API docs: https://github.com/clapfoot/warapi
"""

import logging
import re
from datetime import datetime, timezone

import httpx

from database import AsyncSessionLocal
from models.catalog import Region, War
from repositories.catalog_repository import region_repo, war_repo

logger = logging.getLogger(__name__)

FOXHOLE_API_BASE = "https://war-service-live.foxholeservices.com/api/worldconquest"
WAR_ENDPOINT = f"{FOXHOLE_API_BASE}/war"
MAPS_ENDPOINT = f"{FOXHOLE_API_BASE}/maps"

# Timeout for external HTTP calls (seconds)
HTTP_TIMEOUT = 15.0


def _unix_ms_to_datetime(ts: int | None) -> datetime | None:
    """Convert a unix timestamp in milliseconds to a timezone-aware datetime."""
    if ts is None or ts == 0:
        return None
    return datetime.fromtimestamp(ts / 1000, tz=timezone.utc)


def _hex_name_to_display(hex_name: str) -> str:
    """Convert API hex name like 'TheFingersHex' to human-readable 'The Fingers'.

    The Foxhole API returns region names in PascalCase with a 'Hex' suffix.
    This function strips the suffix and inserts spaces before capitals.
    """
    # Strip trailing "Hex"
    name = hex_name
    if name.endswith("Hex"):
        name = name[:-3]

    # Insert space before each uppercase letter that follows a lowercase letter
    # or before a sequence of uppercase letters followed by a lowercase letter
    display = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", name)
    display = re.sub(r"(?<=[A-Z])(?=[A-Z][a-z])", " ", display)

    return display


async def fetch_war_data() -> dict | None:
    """Fetch current war data from the Foxhole API."""
    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
            response = await client.get(WAR_ENDPOINT)
            response.raise_for_status()
            data = response.json()
            logger.info("Fetched war data: war #%s (warId=%s)", data.get("warNumber"), data.get("warId"))
            return data
    except httpx.HTTPError as exc:
        logger.error("Failed to fetch war data from Foxhole API: %s", exc)
        return None


async def fetch_map_names() -> list[str] | None:
    """Fetch available map/region hex names from the Foxhole API."""
    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
            response = await client.get(MAPS_ENDPOINT)
            response.raise_for_status()
            maps = response.json()
            logger.info("Fetched %d map regions from Foxhole API", len(maps))
            return maps
    except httpx.HTTPError as exc:
        logger.error("Failed to fetch map names from Foxhole API: %s", exc)
        return None


async def sync_war() -> None:
    """Main sync function: fetch war + regions from Foxhole API and persist them.

    This function is designed to be called:
    - On application startup
    - Periodically (daily) via the background scheduler
    - When no current war is configured
    """
    logger.warning("Starting war sync from Foxhole API...")

    war_data = await fetch_war_data()
    if war_data is None:
        logger.warning("Could not fetch war data — skipping sync")
        return

    map_names = await fetch_map_names()

    async with AsyncSessionLocal() as db:
        try:
            await _upsert_war(db, war_data)

            if map_names:
                current_war = await war_repo.get_current(db)
                if current_war:
                    await _sync_regions(db, current_war.id, map_names)

            await db.commit()
            logger.info("War sync completed successfully")
        except Exception:
            await db.rollback()
            logger.exception("War sync failed — rolled back")
            raise


async def _upsert_war(db, war_data: dict) -> War:
    """Create or update the war record from Foxhole API data."""
    war_number = war_data["warNumber"]
    foxhole_war_id = war_data["warId"]
    winner = war_data.get("winner")

    conquest_start = _unix_ms_to_datetime(war_data.get("conquestStartTime"))
    conquest_end = _unix_ms_to_datetime(war_data.get("conquestEndTime"))
    resistance_start = _unix_ms_to_datetime(war_data.get("resistanceStartTime"))
    scheduled_end = _unix_ms_to_datetime(war_data.get("scheduledConquestEndTime"))
    required_vt = war_data.get("requiredVictoryTowns")
    short_required_vt = war_data.get("shortRequiredVictoryTowns")

    # Determine if the war is still active
    is_active = winner == "NONE" and conquest_end is None

    existing_war = await war_repo.get_by_number(db, war_number)

    if existing_war:
        # Update existing war with latest data
        existing_war.foxhole_war_id = foxhole_war_id
        existing_war.winner = winner
        existing_war.started_at = conquest_start
        existing_war.conquest_start_time = conquest_start
        existing_war.conquest_end_time = conquest_end
        existing_war.resistance_start_time = resistance_start
        existing_war.scheduled_conquest_end_time = scheduled_end
        existing_war.required_victory_towns = required_vt
        existing_war.short_required_victory_towns = short_required_vt

        if not is_active and conquest_end:
            existing_war.ended_at = conquest_end

        # If this war ended, it's no longer current
        if not is_active:
            existing_war.is_current = False
        else:
            # Clear other current flags and set this one
            await war_repo.clear_current(db)
            existing_war.is_current = True

        await db.flush()
        logger.info("Updated war #%d (foxhole_war_id=%s)", war_number, foxhole_war_id)
        return existing_war
    else:
        # New war — clear any previous current flag
        if is_active:
            await war_repo.clear_current(db)

        new_war = await war_repo.create(
            db,
            number=war_number,
            foxhole_war_id=foxhole_war_id,
            winner=winner,
            started_at=conquest_start,
            ended_at=conquest_end if not is_active else None,
            is_current=is_active,
            conquest_start_time=conquest_start,
            conquest_end_time=conquest_end,
            resistance_start_time=resistance_start,
            scheduled_conquest_end_time=scheduled_end,
            required_victory_towns=required_vt,
            short_required_victory_towns=short_required_vt,
        )
        logger.info("Created war #%d (foxhole_war_id=%s, is_current=%s)", war_number, foxhole_war_id, is_active)
        return new_war


async def _sync_regions(db, war_id: int, map_names: list[str]) -> None:
    """Create region records for any hex names not yet in the database."""
    existing_regions = await region_repo.list_by_war(db, war_id)
    existing_names = {r.name for r in existing_regions}

    created_count = 0
    for hex_name in map_names:
        display_name = _hex_name_to_display(hex_name)

        if display_name not in existing_names:
            await region_repo.create(
                db,
                war_id=war_id,
                name=display_name,
                hex_code=hex_name,
            )
            created_count += 1

    if created_count > 0:
        logger.info("Created %d new regions for war_id=%d", created_count, war_id)
    else:
        logger.info("All %d regions already exist for war_id=%d", len(map_names), war_id)
