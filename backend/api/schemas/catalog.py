"""Catalog schemas: War, Region, Item, VehicleType."""

from datetime import datetime

from pydantic import BaseModel, Field

from models.enums import Faction, ProductionFacility


# --- War ---

class WarCreate(BaseModel):
    number: int = Field(gt=0)
    started_at: datetime | None = None
    ended_at: datetime | None = None
    is_current: bool = False
    foxhole_war_id: str | None = None
    winner: str | None = None
    conquest_start_time: datetime | None = None
    conquest_end_time: datetime | None = None
    resistance_start_time: datetime | None = None
    scheduled_conquest_end_time: datetime | None = None
    required_victory_towns: int | None = None
    short_required_victory_towns: int | None = None


class WarUpdate(BaseModel):
    number: int | None = Field(default=None, gt=0)
    started_at: datetime | None = None
    ended_at: datetime | None = None
    is_current: bool | None = None
    foxhole_war_id: str | None = None
    winner: str | None = None
    conquest_start_time: datetime | None = None
    conquest_end_time: datetime | None = None
    resistance_start_time: datetime | None = None
    scheduled_conquest_end_time: datetime | None = None
    required_victory_towns: int | None = None
    short_required_victory_towns: int | None = None


class WarResponse(BaseModel):
    id: int
    number: int
    started_at: datetime | None
    ended_at: datetime | None
    is_current: bool
    foxhole_war_id: str | None
    winner: str | None
    conquest_start_time: datetime | None
    conquest_end_time: datetime | None
    resistance_start_time: datetime | None
    scheduled_conquest_end_time: datetime | None
    required_victory_towns: int | None
    short_required_victory_towns: int | None

    model_config = {"from_attributes": True}


# --- Region ---

class RegionCreate(BaseModel):
    war_id: int
    name: str = Field(min_length=1, max_length=255)
    hex_code: str | None = None


class RegionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    hex_code: str | None = None


class RegionResponse(BaseModel):
    id: int
    war_id: int
    name: str
    hex_code: str | None

    model_config = {"from_attributes": True}


# --- Item ---

class ItemCreate(BaseModel):
    code: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=255)
    category: str = Field(min_length=1, max_length=100)
    faction: Faction
    stack_size: int = Field(gt=0)
    crate_size: int = Field(gt=0)
    produced_at: ProductionFacility
    icon_url: str | None = None


class ItemUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=50)
    name: str | None = Field(default=None, min_length=1, max_length=255)
    category: str | None = Field(default=None, min_length=1, max_length=100)
    faction: Faction | None = None
    stack_size: int | None = Field(default=None, gt=0)
    crate_size: int | None = Field(default=None, gt=0)
    produced_at: ProductionFacility | None = None
    icon_url: str | None = None


class ItemResponse(BaseModel):
    id: int
    code: str
    name: str
    category: str
    faction: str
    stack_size: int
    crate_size: int
    produced_at: str
    icon_url: str | None

    model_config = {"from_attributes": True}


# --- VehicleType ---

class VehicleTypeCreate(BaseModel):
    code: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=255)
    category: str = Field(min_length=1, max_length=100)
    faction: Faction
    produced_at: ProductionFacility
    cargo_slots: int | None = None
    icon_url: str | None = None


class VehicleTypeUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=50)
    name: str | None = Field(default=None, min_length=1, max_length=255)
    category: str | None = Field(default=None, min_length=1, max_length=100)
    faction: Faction | None = None
    produced_at: ProductionFacility | None = None
    cargo_slots: int | None = None
    icon_url: str | None = None


class VehicleTypeResponse(BaseModel):
    id: int
    code: str
    name: str
    category: str
    faction: str
    produced_at: str
    cargo_slots: int | None
    icon_url: str | None

    model_config = {"from_attributes": True}
