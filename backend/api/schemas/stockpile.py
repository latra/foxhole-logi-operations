"""Stockpile schemas."""

from datetime import datetime

from pydantic import BaseModel, Field

from models.enums import StockpileStructure, StockpileType


class StockpileCreate(BaseModel):
    group_id: str
    war_id: int
    region_id: int
    structure_type: StockpileStructure
    code_6digit: str = Field(max_length=6)
    name: str = Field(min_length=1, max_length=255)
    type: StockpileType = StockpileType.PRIVATE
    notes: str | None = None
    # Optional exact map location — set when picked on the war map layer
    # (a specific Storage Depot/Seaport/etc.) instead of just typing a region.
    map_hex: str | None = None
    map_x: float | None = None
    map_y: float | None = None


class StockpileUpdate(BaseModel):
    region_id: int | None = None
    structure_type: StockpileStructure | None = None
    code_6digit: str | None = Field(default=None, max_length=6)
    name: str | None = Field(default=None, min_length=1, max_length=255)
    type: StockpileType | None = None
    notes: str | None = None
    map_hex: str | None = None
    map_x: float | None = None
    map_y: float | None = None


class StockpileResponse(BaseModel):
    id: str
    group_id: str
    war_id: int
    region_id: int
    structure_type: str
    code_6digit: str
    name: str
    type: str
    notes: str | None
    map_hex: str | None
    map_x: float | None
    map_y: float | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
