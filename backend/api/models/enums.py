"""Centralized enums for the Foxhole Logistics Manager."""

from enum import Enum


class Faction(str, Enum):
    COLONIAL = "COLONIAL"
    WARDEN = "WARDEN"
    NEUTRAL = "NEUTRAL"


class MembershipRole(str, Enum):
    OWNER = "OWNER"
    OFFICER = "OFFICER"
    LOGI_OFFICER = "LOGI_OFFICER"
    MEMBER = "MEMBER"
    RECRUIT = "RECRUIT"


class MembershipStatus(str, Enum):
    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    REMOVED = "REMOVED"


class StockpileStructure(str, Enum):
    SEAPORT = "SEAPORT"
    STORAGE_DEPOT = "STORAGE_DEPOT"
    BUNKER_BASE = "BUNKER_BASE"
    KEEP = "KEEP"
    TOWN_BASE = "TOWN_BASE"


class StockpileType(str, Enum):
    PUBLIC = "PUBLIC"
    PRIVATE = "PRIVATE"


class ProductionFacility(str, Enum):
    FACTORY = "FACTORY"
    MPF = "MPF"
    GARAGE = "GARAGE"
    SMALL_ASSEMBLY = "SMALL_ASSEMBLY"
    LARGE_ASSEMBLY = "LARGE_ASSEMBLY"
    REFINERY = "REFINERY"
    SHIPYARD = "SHIPYARD"
    MATERIALS_FACTORY = "MATERIALS_FACTORY"
    METALWORKS_FACTORY = "METALWORKS_FACTORY"
    OIL_REFINERY = "OIL_REFINERY"
    AMMUNITION_FACTORY = "AMMUNITION_FACTORY"
    AIRCRAFT_MAINTENANCE = "AIRCRAFT_MAINTENANCE"


class OperationStatus(str, Enum):
    PLANNED = "PLANNED"
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class SignupStatus(str, Enum):
    ATTENDING = "ATTENDING"
    ARRIVING_LATE = "ARRIVING_LATE"
    CANCELLED = "CANCELLED"


class Priority(str, Enum):
    CRITICAL = "CRITICAL"
    REQUIRED = "REQUIRED"
    PREFERRED = "PREFERRED"
    OPTIONAL = "OPTIONAL"


class OrderStatus(str, Enum):
    DRAFT = "DRAFT"
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class ProductionStatus(str, Enum):
    TODO = "TODO"
    CLAIMED = "CLAIMED"
    IN_PROGRESS = "IN_PROGRESS"
    READY = "READY"
    DELIVERED = "DELIVERED"
    BLOCKED = "BLOCKED"


class TransportStatus(str, Enum):
    PLANNED = "PLANNED"
    LOADING = "LOADING"
    EN_ROUTE = "EN_ROUTE"
    DELIVERED = "DELIVERED"
    LOST = "LOST"
    CANCELLED = "CANCELLED"


class ProductionTargetType(str, Enum):
    RESOURCE_REQUEST = "RESOURCE_REQUEST"
    VEHICLE_REQUEST = "VEHICLE_REQUEST"
