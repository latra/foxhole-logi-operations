"""Logistics schemas: LogisticsOrder, ResourceRequest, VehicleRequest."""

from datetime import datetime

from pydantic import BaseModel, Field

from models.enums import OrderStatus, Priority


class LogisticsOrderCreate(BaseModel):
    group_id: str
    operation_id: str | None = None
    name: str = Field(min_length=1, max_length=255)
    source_stockpile_id: str | None = None
    destination_stockpile_id: str
    priority: Priority = Priority.REQUIRED
    deadline: datetime | None = None
    notes: str | None = None


class LogisticsOrderUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    operation_id: str | None = None
    source_stockpile_id: str | None = None
    destination_stockpile_id: str | None = None
    priority: Priority | None = None
    status: OrderStatus | None = None
    deadline: datetime | None = None
    notes: str | None = None


class LogisticsOrderResponse(BaseModel):
    id: str
    group_id: str
    operation_id: str | None
    name: str
    source_stockpile_id: str | None
    destination_stockpile_id: str
    priority: str
    status: str
    deadline: datetime | None
    notes: str | None
    created_by: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- ResourceRequest ---

class ResourceRequestCreate(BaseModel):
    order_id: str
    item_id: int
    quantity_crates: int = Field(gt=0)
    priority: Priority = Priority.REQUIRED
    notes: str | None = None


class ResourceRequestUpdate(BaseModel):
    item_id: int | None = None
    quantity_crates: int | None = Field(default=None, gt=0)
    priority: Priority | None = None
    notes: str | None = None


class ResourceRequestResponse(BaseModel):
    id: str
    order_id: str
    item_id: int
    quantity_crates: int
    priority: str
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- VehicleRequest ---

class VehicleRequestCreate(BaseModel):
    order_id: str
    vehicle_type_id: int
    quantity: int = Field(gt=0)
    priority: Priority = Priority.REQUIRED
    notes: str | None = None


class VehicleRequestUpdate(BaseModel):
    vehicle_type_id: int | None = None
    quantity: int | None = Field(default=None, gt=0)
    priority: Priority | None = None
    notes: str | None = None


class VehicleRequestResponse(BaseModel):
    id: str
    order_id: str
    vehicle_type_id: int
    quantity: int
    priority: str
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- LogisticsOrderVehicle (slot-grid editor) ---

class LogisticsOrderVehicleCreate(BaseModel):
    vehicle_type_id: int
    display_name: str | None = Field(default=None, max_length=100)


class LogisticsOrderVehicleUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=100)
    sort_order: int | None = None
    assigned_to: str | None = None
    completed: bool | None = None


class LogisticsOrderVehicleResponse(BaseModel):
    id: str
    order_id: str
    vehicle_type_id: int
    display_name: str
    sort_order: int
    assigned_to: str | None
    completed: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- LogisticsOrderItem (slot-grid editor) ---

class LogisticsOrderItemCreate(BaseModel):
    item_id: int
    vehicle_id: str | None = None
    slot_index: int | None = Field(default=None, ge=0)


class LogisticsOrderItemMove(BaseModel):
    vehicle_id: str | None = None
    slot_index: int | None = Field(default=None, ge=0)
    assigned_to: str | None = None
    completed: bool | None = None


class LogisticsOrderItemResponse(BaseModel):
    id: str
    order_id: str
    vehicle_id: str | None
    item_id: int
    slot_index: int
    assigned_to: str | None
    completed: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
