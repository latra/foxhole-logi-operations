/* ── Enums mirroring backend (const objects for erasable TS) ──────── */

export const Faction = {
  COLONIAL: "COLONIAL",
  WARDEN: "WARDEN",
  NEUTRAL: "NEUTRAL",
} as const;
export type Faction = (typeof Faction)[keyof typeof Faction];

export const MembershipRole = {
  OWNER: "OWNER",
  OFFICER: "OFFICER",
  LOGI_OFFICER: "LOGI_OFFICER",
  MEMBER: "MEMBER",
  RECRUIT: "RECRUIT",
} as const;
export type MembershipRole = (typeof MembershipRole)[keyof typeof MembershipRole];

export const MembershipStatus = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  REMOVED: "REMOVED",
} as const;
export type MembershipStatus = (typeof MembershipStatus)[keyof typeof MembershipStatus];

export const OperationStatus = {
  PLANNED: "PLANNED",
  OPEN: "OPEN",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;
export type OperationStatus = (typeof OperationStatus)[keyof typeof OperationStatus];

export const SignupStatus = {
  ATTENDING: "ATTENDING",
  ARRIVING_LATE: "ARRIVING_LATE",
  CANCELLED: "CANCELLED",
} as const;
export type SignupStatus = (typeof SignupStatus)[keyof typeof SignupStatus];

export const Priority = {
  CRITICAL: "CRITICAL",
  REQUIRED: "REQUIRED",
  PREFERRED: "PREFERRED",
  OPTIONAL: "OPTIONAL",
} as const;
export type Priority = (typeof Priority)[keyof typeof Priority];

export const OrderStatus = {
  DRAFT: "DRAFT",
  OPEN: "OPEN",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const StockpileStructure = {
  SEAPORT: "SEAPORT",
  STORAGE_DEPOT: "STORAGE_DEPOT",
  BUNKER_BASE: "BUNKER_BASE",
  KEEP: "KEEP",
  TOWN_BASE: "TOWN_BASE",
} as const;
export type StockpileStructure = (typeof StockpileStructure)[keyof typeof StockpileStructure];

export const StockpileType = {
  PUBLIC: "PUBLIC",
  PRIVATE: "PRIVATE",
} as const;
export type StockpileType = (typeof StockpileType)[keyof typeof StockpileType];
