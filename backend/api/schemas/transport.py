"""Transport schemas: TransportRun, TransportCargo."""

from datetime import datetime

from pydantic import BaseModel, Field

from models.enums import TransportStatus


class TransportRunCreate(BaseModel):
    order_id: str
    driver_id: str | None = None
    vehicle_type_id: int
    origin_stockpile_id: str
    destination_stockpile_id: str
    notes: str | None = None


class TransportRunUpdate(BaseModel):
    driver_id: str | None = None
    vehicle_type_id: int | None = None
    origin_stockpile_id: str | None = None
    destination_stockpile_id: str | None = None
    status: TransportStatus | None = None
    departed_at: datetime | None = None
    arrived_at: datetime | None = None
    notes: str | None = None


class TransportRunResponse(BaseModel):
    id: str
    order_id: str
    driver_id: str | None
    vehicle_type_id: int
    origin_stockpile_id: str
    destination_stockpile_id: str
    status: str
    departed_at: datetime | None
    arrived_at: datetime | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- TransportCargo ---

class TransportCargoCreate(BaseModel):
    transport_run_id: str
    resource_request_id: str
    quantity_crates: int = Field(gt=0)


class TransportCargoUpdate(BaseModel):
    quantity_crates: int | None = Field(default=None, gt=0)


class TransportCargoResponse(BaseModel):
    id: str
    transport_run_id: str
    resource_request_id: str
    quantity_crates: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
