"""ProductionTask schemas."""

from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from models.enums import ProductionStatus, ProductionTargetType


class ProductionTaskCreate(BaseModel):
    order_id: str
    target_type: ProductionTargetType
    resource_request_id: str | None = None
    vehicle_request_id: str | None = None
    assignee_id: str | None = None
    facility_stockpile_id: str | None = None
    quantity: int = Field(gt=0)
    notes: str | None = None

    @model_validator(mode="after")
    def validate_target_fk(self):
        if self.target_type == ProductionTargetType.RESOURCE_REQUEST:
            if not self.resource_request_id or self.vehicle_request_id:
                raise ValueError(
                    "For RESOURCE_REQUEST target, resource_request_id must be set and vehicle_request_id must be null"
                )
        elif self.target_type == ProductionTargetType.VEHICLE_REQUEST:
            if not self.vehicle_request_id or self.resource_request_id:
                raise ValueError(
                    "For VEHICLE_REQUEST target, vehicle_request_id must be set and resource_request_id must be null"
                )
        return self


class ProductionTaskUpdate(BaseModel):
    assignee_id: str | None = None
    facility_stockpile_id: str | None = None
    quantity: int | None = Field(default=None, gt=0)
    status: ProductionStatus | None = None
    notes: str | None = None


class ProductionTaskResponse(BaseModel):
    id: str
    order_id: str
    target_type: str
    resource_request_id: str | None
    vehicle_request_id: str | None
    assignee_id: str | None
    facility_stockpile_id: str | None
    quantity: int
    status: str
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
