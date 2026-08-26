"""Operation, OperationGroupInvite, and OperationSignup schemas."""

from datetime import datetime

from pydantic import BaseModel, Field

from models.enums import OperationStatus, SignupStatus


# --- Operation plan (structured drawing, mirrors frontend MapShape) ---

class PlanShapePoint(BaseModel):
    x: float
    y: float


class PlanShape(BaseModel):
    id: str
    type: str
    p1: PlanShapePoint
    p2: PlanShapePoint
    color: str
    strokeWidth: float
    text: str | None = None
    author: str
    rotation: float | None = None


# --- Operation ---

class OperationCreate(BaseModel):
    group_id: str
    war_id: int
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    scheduled_at: datetime
    duration_minutes: int | None = Field(default=None, gt=0)
    region_id: int | None = None
    location_detail: str | None = Field(default=None, max_length=500)
    invited_group_ids: list[str] = Field(default_factory=list)
    plan_shapes: list[PlanShape] | None = None


class OperationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    scheduled_at: datetime | None = None
    duration_minutes: int | None = Field(default=None, gt=0)
    region_id: int | None = None
    location_detail: str | None = Field(default=None, max_length=500)
    status: OperationStatus | None = None
    debrief: str | None = None


class InvitedGroupInfo(BaseModel):
    id: str
    name: str
    tag: str
    faction: str

    model_config = {"from_attributes": True}


class OperationResponse(BaseModel):
    id: str
    group_id: str
    war_id: int
    name: str
    description: str | None
    scheduled_at: datetime
    duration_minutes: int | None
    region_id: int | None
    location_detail: str | None
    plan_shapes: list[PlanShape] | None = None
    debrief: str | None = None
    status: str
    created_by: str
    created_at: datetime
    updated_at: datetime
    invited_groups: list[InvitedGroupInfo] = []

    model_config = {"from_attributes": True}


# --- Group invite ---

class OperationInviteCreate(BaseModel):
    group_ids: list[str] = Field(min_length=1)


class OperationGroupInviteResponse(BaseModel):
    id: str
    operation_id: str
    group_id: str
    invited_at: datetime

    model_config = {"from_attributes": True}


# --- OperationSignup (simplified: ATTENDING / ARRIVING_LATE) ---

class OperationSignupCreate(BaseModel):
    status: SignupStatus = SignupStatus.ATTENDING


class OperationSignupUpdate(BaseModel):
    status: SignupStatus | None = None


class SignupUserInfo(BaseModel):
    id: str
    display_name: str
    avatar_url: str | None

    model_config = {"from_attributes": True}


class OperationSignupResponse(BaseModel):
    id: str
    operation_id: str
    user_id: str
    status: str
    signed_up_at: datetime
    updated_at: datetime
    user: SignupUserInfo | None = None

    model_config = {"from_attributes": True}
