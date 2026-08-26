"""Map session schemas."""

from datetime import datetime

from pydantic import BaseModel


# --- Shared map drawing shapes (mirrors frontend MapShape / schemas.operation.PlanShape) ---

class MapShapePoint(BaseModel):
    x: float
    y: float


class MapShapeIn(BaseModel):
    id: str
    type: str
    p1: MapShapePoint
    p2: MapShapePoint
    color: str
    strokeWidth: float
    text: str | None = None
    author: str
    rotation: float | None = None


class MapSessionResponse(BaseModel):
    id: str
    code: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
