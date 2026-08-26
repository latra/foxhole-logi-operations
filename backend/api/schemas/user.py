"""User schemas."""

from datetime import datetime

from pydantic import BaseModel, Field


class UserResponse(BaseModel):
    id: str
    discord_id: str
    username: str
    display_name: str
    avatar_url: str | None
    last_login_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=255)
    avatar_url: str | None = None
