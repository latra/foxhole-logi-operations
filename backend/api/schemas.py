from enum import IntEnum
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class ThingStatus(IntEnum):
    REGISTERED = 0
    PENDING_CLASSIFY = 1
    PROCESSED = 2
    CHECKED = 3
    NOTIFIED = 4
    FINISHED = 5


ThingType = Literal["notes", "watch_later", "task", "reminder", "file"]

class UserRegister(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=6)
    profile_picture: str | None = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    profile_picture: str | None

    model_config = {"from_attributes": True}
