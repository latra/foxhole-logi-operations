"""AuditLog schemas."""

from datetime import datetime

from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    id: str
    entity_type: str
    entity_id: str
    user_id: str | None
    action: str
    diff: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
