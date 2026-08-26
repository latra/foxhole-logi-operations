/* ── TypeScript interfaces mirroring backend response schemas ─────── */

import type { MapShape } from "../components/map/mapTypes";

export interface User {
  id: string;
  discord_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  last_login_at: string | null;
}

export interface Group {
  id: string;
  name: string;
  tag: string;
  faction: "COLONIAL" | "WARDEN" | "NEUTRAL";
  discord_guild_id: string;
  discord_member_role_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemberUserInfo {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
}

export interface GroupMembership {
  id: string;
  group_id: string;
  user_id: string;
  role: "OWNER" | "OFFICER" | "LOGI_OFFICER" | "MEMBER" | "RECRUIT";
  status: "PENDING" | "ACTIVE" | "INACTIVE" | "REMOVED";
  joined_at: string;
  left_at: string | null;
  user: MemberUserInfo | null;
}

export interface War {
  id: number;
  number: number;
  started_at: string | null;
  ended_at: string | null;
  is_current: boolean;
}

export interface Region {
  id: number;
  war_id: number;
  name: string;
  hex_code: string | null;
}

export interface InvitedGroupInfo {
  id: string;
  name: string;
  tag: string;
  faction: string;
}

export interface Operation {
  id: string;
  group_id: string;
  war_id: number;
  name: string;
  description: string | null;
  scheduled_at: string;
  duration_minutes: number | null;
  region_id: number | null;
  location_detail: string | null;
  plan_shapes: MapShape[] | null;
  debrief: string | null;
  status: "PLANNED" | "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  created_by: string;
  created_at: string;
  updated_at: string;
  invited_groups: InvitedGroupInfo[];
}

export interface SignupUser {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

export interface OperationSignup {
  id: string;
  operation_id: string;
  user_id: string;
  status: "ATTENDING" | "ARRIVING_LATE" | "CANCELLED";
  signed_up_at: string;
  updated_at: string;
  user: SignupUser | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

/* ── Stockpiles ──────────────────────────────────────────────────── */

export interface Stockpile {
  id: string;
  group_id: string;
  war_id: number;
  region_id: number;
  structure_type: string;
  code_6digit: string;
  name: string;
  type: string;
  notes: string | null;
  /** Exact map location, when picked on the war map layer instead of typed as a region. */
  map_hex: string | null;
  map_x: number | null;
  map_y: number | null;
  created_at: string;
  updated_at: string;
}

/* ── Logistics Orders ────────────────────────────────────────────── */

export interface LogisticsOrder {
  id: string;
  group_id: string;
  operation_id: string | null;
  name: string;
  source_stockpile_id: string | null;
  destination_stockpile_id: string;
  priority: string;
  status: "DRAFT" | "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  deadline: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ResourceRequest {
  id: string;
  order_id: string;
  item_id: number;
  quantity_crates: number;
  priority: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface VehicleRequest {
  id: string;
  order_id: string;
  vehicle_type_id: number;
  quantity: number;
  priority: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/* ── Slot-grid editor: vehicles + item placements within an order ─── */

export interface LogisticsOrderVehicle {
  id: string;
  order_id: string;
  vehicle_type_id: number;
  display_name: string;
  sort_order: number;
  assigned_to: string | null;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface LogisticsOrderItem {
  id: string;
  order_id: string;
  vehicle_id: string | null;
  item_id: number;
  slot_index: number;
  assigned_to: string | null;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

/* ── Item catalog UI shape (mapped from CatalogItem — see api/catalog.ts toFoxholeItem) ── */

export interface FoxholeItem {
  itemName: string;
  displayId: string;
  categoryName: string;
  description: string;
  iconPath: string;
  faction: "W" | "C" | "N";
}

export interface VehicleDefinition {
  id: string;
  name: string;
  faction: "WARDEN" | "COLONIAL" | "NEUTRAL";
  category:
    | "truck"
    | "ship"
    | "train"
    | "crane"
    | "motorcycle"
    | "armored_car"
    | "half_track"
    | "tank"
    | "other";
  slotCount: number;
  slotRows: number;
  slotCols: number;
  canCarryShippables: boolean;
  iconUrl: string;
}

/* ── Backend catalog (the FK targets for resource/vehicle requests) ─── */

export interface CatalogItem {
  id: number;
  code: string;
  name: string;
  category: string;
  faction: string;
  /** Units per full loose stack (uncrated). */
  stack_size: number;
  /** Units packed into one crate — independent of stack_size. */
  crate_size: number;
  produced_at: string;
  icon_url: string | null;
}

export interface CatalogVehicleType {
  id: number;
  code: string;
  name: string;
  category: string;
  faction: string;
  produced_at: string;
  cargo_slots: number | null;
  icon_url: string | null;
}
