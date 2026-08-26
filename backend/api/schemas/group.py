"""Group and GroupMembership schemas."""

from datetime import datetime

from pydantic import BaseModel, Field

from models.enums import Faction, MembershipRole, MembershipStatus


class GroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    tag: str = Field(min_length=1, max_length=50)
    faction: Faction
    discord_guild_id: str = Field(min_length=1, max_length=50)
    discord_member_role_id: str | None = None


class GroupUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    tag: str | None = Field(default=None, min_length=1, max_length=50)
    faction: Faction | None = None
    discord_member_role_id: str | None = None


class GroupResponse(BaseModel):
    id: str
    name: str
    tag: str
    faction: str
    discord_guild_id: str
    discord_member_role_id: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- GroupMembership ---

class GroupMembershipCreate(BaseModel):
    group_id: str
    user_id: str
    role: MembershipRole = MembershipRole.MEMBER


class GroupMembershipUpdate(BaseModel):
    role: MembershipRole | None = None
    status: MembershipStatus | None = None


class MemberUserInfo(BaseModel):
    id: str
    display_name: str
    username: str
    avatar_url: str | None

    model_config = {"from_attributes": True}


class GroupMembershipResponse(BaseModel):
    id: str
    group_id: str
    user_id: str
    role: str
    status: str
    joined_at: datetime
    left_at: datetime | None
    user: MemberUserInfo | None = None

    model_config = {"from_attributes": True}
