/* ── Points of interest from the live Foxhole War API ─────────────────
 *
 * Fetches each hex's dynamic map data (public.war-service-live) and
 * turns its mapItems into canvas-pixel points colored by controlling
 * faction. See hexGeometry.ts for the coordinate projection.
 */

import { HEX_AXIAL, hexItemToPixel } from "./hexGeometry";

export type Faction = "WARDENS" | "COLONIALS" | "NONE";

export interface WarPoi {
  hex: string;
  teamId: Faction;
  iconType: number;
  /** Canvas pixel position on the composite map (see hexGeometry.ts). */
  x: number;
  y: number;
  /** The War API's own fractional (0..1) position within the hex — stable
   *  across any change to this app's pixel calibration, so it's what gets
   *  persisted (e.g. a stockpile's picked map location). */
  fracX: number;
  fracY: number;
}

export const FACTION_COLORS: Record<Faction, string> = {
  WARDENS: "#3b82f6", // blue
  COLONIALS: "#22c55e", // green
  NONE: "#ffffff", // white
};

/** War API mapItem.iconType → human-readable structure name.
 *  See MapStructure enum in community War API tooling (e.g. Snappey/Foxhole-Map). */
export const STRUCTURE_NAMES: Record<number, string> = {

  11: "Hospital",
  12: "Vehicle Factory",
  13: "Armory",
  14: "Supply Station",
  15: "Workshop",
  16: "Manufacturing Plant",
  17: "Refinery",
  18: "Shipyard",
  19: "Tech Center",
  20: "Salvage Field",
  21: "Component Field",
  22: "Fuel Field",
  23: "Sulfur Field",
  24: "World Map Tent",
  25: "Travel Tent",
  26: "Training Area",
  27: "Special Base (Keep)",
  28: "Observation Tower",
  29: "Fort",
  30: "Troop Ship",
  32: "Sulfur Mine",
  33: "Storage Facility",
  34: "Factory",
  35: "Garrison Station",
  36: "Ammo Factory",
  37: "Rocket Site",
  38: "Salvage Mine",
  39: "Construction Yard",
  40: "Component Mine",
  41: "Oil Well",
  45: "Relic Base",
  46: "Relic Base",
  47: "Relic Base",
  51: "Mass Production Factory",
  52: "Seaport",
  53: "Coastal Gun",
  54: "Soul Factory",
  56: "Town Base",
  57: "Town Base",
  58: "Town Base",
  59: "Storm Cannon",
  60: "Intel Center",
  61: "Coal Field",
  62: "Oil Field",
  70: "Rocket Target",
  71: "Rocket Ground Zero",
  72: "Rocket Site (Armed)",
  75: "Oil Rig",
  83: "Weather Station",
  84: "Mortar House",
  88: "Aircraft Depot",
  89: "Aircraft Factory",
  90: "Aircraft Radar",
  91: "Aircraft Runway (T1)",
  92: "Aircraft Runway (T2)",
  97: "Anti-Air Gun"
};

export function structureName(iconType: number): string {
  return STRUCTURE_NAMES[iconType] ?? `Unknown (${iconType})`;
}

/** Structure name → Material Icons ligature name, drawn on the canvas in place
 *  of a plain dot (see MapCanvas.tsx). Material Icons is the same open-source
 *  icon font already used throughout this app's UI (index.html) — these are
 *  original, generic glyphs picked for a reasonable semantic match, not a
 *  reproduction of Foxhole's own (copyrighted) in-game icon art. */
const STRUCTURE_ICONS: Record<string, string> = {
  Hospital: "local_hospital",
  "Vehicle Factory": "directions_car",
  Armory: "security",
  "Supply Station": "local_shipping",
  Workshop: "build",
  "Manufacturing Plant": "precision_manufacturing",
  Refinery: "factory",
  Shipyard: "directions_boat",
  "Tech Center": "memory",
  "Salvage Field": "recycling",
  "Component Field": "extension",
  "Fuel Field": "local_gas_station",
  "Sulfur Field": "science",
  "World Map Tent": "map",
  "Travel Tent": "hiking",
  "Training Area": "fitness_center",
  "Special Base (Keep)": "castle",
  "Observation Tower": "visibility",
  Fort: "shield",
  "Troop Ship": "directions_boat",
  "Sulfur Mine": "terrain",
  "Storage Facility": "warehouse",
  Factory: "factory",
  "Garrison Station": "military_tech",
  "Ammo Factory": "local_fire_department",
  "Rocket Site": "rocket_launch",
  "Salvage Mine": "construction",
  "Construction Yard": "engineering",
  "Component Mine": "hardware",
  "Oil Well": "opacity",
  "Relic Base": "account_balance",
  "Mass Production Factory": "factory",
  Seaport: "anchor",
  "Coastal Gun": "gps_fixed",
  "Soul Factory": "auto_awesome",
  "Town Base": "home_work",
  "Storm Cannon": "bolt",
  "Intel Center": "satellite_alt",
  "Coal Field": "terrain",
  "Oil Field": "opacity",
  "Rocket Target": "my_location",
  "Rocket Ground Zero": "warning",
  "Rocket Site (Armed)": "rocket_launch",
  "Oil Rig": "opacity",
  "Weather Station": "cloud",
  "Mortar House": "adjust",
  "Aircraft Depot": "flight",
  "Aircraft Factory": "flight_takeoff",
  "Aircraft Radar": "radar",
  "Aircraft Runway (T1)": "flight_land",
  "Aircraft Runway (T2)": "flight_land",
  "Anti-Air Gun": "gps_not_fixed",
};

const DEFAULT_STRUCTURE_ICON = "place";

export function structureIcon(iconType: number): string {
  return STRUCTURE_ICONS[structureName(iconType)] ?? DEFAULT_STRUCTURE_ICON;
}

/** Same lookup as structureIcon(), but by structure name directly — used by
 *  the map layers panel, which works off ALL_STRUCTURE_NAMES rather than a
 *  live War API iconType. */
export function iconForStructureName(name: string): string {
  return STRUCTURE_ICONS[name] ?? DEFAULT_STRUCTURE_ICON;
}

/** Every distinct structure name, sorted — drives the map layers panel's checklist. */
export const ALL_STRUCTURE_NAMES: string[] = Array.from(new Set(Object.values(STRUCTURE_NAMES))).sort();

/* ── Categories — groups the map layers panel's checklist, each toggleable as a whole ── */
export const STRUCTURE_CATEGORIES = ["RESOURCES", "STORAGE", "BUILDINGS", "DEFENCES"] as const;
export type StructureCategory = (typeof STRUCTURE_CATEGORIES)[number];

const STRUCTURE_CATEGORY: Record<string, StructureCategory> = {
  // RESOURCES — raw extraction points (fields, mines, wells/rigs)
  "Salvage Field": "RESOURCES",
  "Component Field": "RESOURCES",
  "Fuel Field": "RESOURCES",
  "Sulfur Field": "RESOURCES",
  "Sulfur Mine": "RESOURCES",
  "Salvage Mine": "RESOURCES",
  "Component Mine": "RESOURCES",
  "Oil Well": "RESOURCES",
  "Coal Field": "RESOURCES",
  "Oil Field": "RESOURCES",
  "Oil Rig": "RESOURCES",

  // STORAGE — holds/dispenses resources
  "Storage Facility": "STORAGE",
  "Supply Station": "STORAGE",
  Seaport: "STORAGE",

  // BUILDINGS — production, utility, and other non-combat facilities
  Hospital: "BUILDINGS",
  "Vehicle Factory": "BUILDINGS",
  Armory: "BUILDINGS",
  Workshop: "BUILDINGS",
  "Manufacturing Plant": "BUILDINGS",
  Refinery: "BUILDINGS",
  Shipyard: "BUILDINGS",
  "Tech Center": "BUILDINGS",
  "World Map Tent": "BUILDINGS",
  "Travel Tent": "BUILDINGS",
  "Training Area": "BUILDINGS",
  "Troop Ship": "BUILDINGS",
  Factory: "BUILDINGS",
  "Ammo Factory": "BUILDINGS",
  "Construction Yard": "BUILDINGS",
  "Mass Production Factory": "BUILDINGS",
  "Soul Factory": "BUILDINGS",
  "Intel Center": "BUILDINGS",
  "Weather Station": "BUILDINGS",
  "Aircraft Depot": "BUILDINGS",
  "Aircraft Factory": "BUILDINGS",
  "Aircraft Runway (T1)": "BUILDINGS",
  "Aircraft Runway (T2)": "BUILDINGS",

  // DEFENCES — bases and combat/military structures
  "Special Base (Keep)": "DEFENCES",
  "Observation Tower": "DEFENCES",
  Fort: "DEFENCES",
  "Garrison Station": "DEFENCES",
  "Rocket Site": "DEFENCES",
  "Relic Base": "DEFENCES",
  "Coastal Gun": "DEFENCES",
  "Town Base": "DEFENCES",
  "Storm Cannon": "DEFENCES",
  "Rocket Target": "DEFENCES",
  "Rocket Ground Zero": "DEFENCES",
  "Rocket Site (Armed)": "DEFENCES",
  "Mortar House": "DEFENCES",
  "Aircraft Radar": "DEFENCES",
  "Anti-Air Gun": "DEFENCES",
};

export function categoryForStructureName(name: string): StructureCategory {
  return STRUCTURE_CATEGORY[name] ?? "BUILDINGS";
}

/** Structure names grouped by category, each list sorted — drives the panel's grouped sections. */
export const STRUCTURE_NAMES_BY_CATEGORY: Record<StructureCategory, string[]> = (() => {
  const grouped: Record<StructureCategory, string[]> = {
    RESOURCES: [],
    STORAGE: [],
    BUILDINGS: [],
    DEFENCES: [],
  };
  for (const name of ALL_STRUCTURE_NAMES) {
    grouped[categoryForStructureName(name)].push(name);
  }
  return grouped;
})();

/** Cheap, order-independent content signature — used to detect whether a
 *  freshly-fetched POI list actually differs from what's on screen, so
 *  periodic refreshes only touch the map when the war layer really changed. */
export function warPoisSignature(pois: WarPoi[]): string {
  const parts = pois.map(
    (p) => `${p.hex}|${p.iconType}|${p.teamId}|${p.x.toFixed(1)}|${p.y.toFixed(1)}`
  );
  parts.sort();
  return parts.join(";");
}

/** Human-readable hex name from its War API code, e.g. "DeadLandsHex" → "Dead Lands". */
export function hexDisplayName(hexCode: string): string {
  const name = hexCode.endsWith("Hex") ? hexCode.slice(0, -3) : hexCode;
  return name
    .replace(/(?<=[a-z])(?=[A-Z])/g, " ")
    .replace(/(?<=[A-Z])(?=[A-Z][a-z])/g, " ");
}

/** War API iconType(s) for each stockpile-relevant structure — matches the
 *  StockpileStructure enum in types/enums.ts (kept as plain strings here to
 *  avoid a cross-layer import). */
export const STOCKPILE_ICON_TYPES: Record<string, number[]> = {
  SEAPORT: [52],
  STORAGE_DEPOT: [33],
  BUNKER_BASE: [35],
  KEEP: [27],
  TOWN_BASE: [56, 57, 58],
};

const STOCKPILE_ICON_TYPE_SET = new Set(Object.values(STOCKPILE_ICON_TYPES).flat());

export function isStockpileStructureIcon(iconType: number): boolean {
  return STOCKPILE_ICON_TYPE_SET.has(iconType);
}

/** Which StockpileStructure value a clicked map icon corresponds to, if any. */
export function stockpileStructureForIconType(iconType: number): string | null {
  for (const [structureType, icons] of Object.entries(STOCKPILE_ICON_TYPES)) {
    if (icons.includes(iconType)) return structureType;
  }
  return null;
}

/** Rebuild a plottable point from a persisted (hex, fracX, fracY) — e.g. to
 *  show a previously-picked stockpile location on the map again. */
export function poiFromFraction(
  hex: string,
  fracX: number,
  fracY: number,
  extra: Partial<Pick<WarPoi, "teamId" | "iconType">> = {}
): WarPoi | null {
  const pixel = hexItemToPixel(hex, fracX, fracY);
  if (!pixel) return null;
  return {
    hex,
    teamId: extra.teamId ?? "NONE",
    iconType: extra.iconType ?? 0,
    x: pixel.x,
    y: pixel.y,
    fracX,
    fracY,
  };
}

const WAR_API_BASE = "https://war-service-live.foxholeservices.com/api/worldconquest";

interface WarApiMapItem {
  teamId: Faction;
  iconType: number;
  x: number;
  y: number;
}

interface WarApiDynamicResponse {
  mapItems?: WarApiMapItem[];
}

async function fetchHexPois(hexName: string): Promise<WarPoi[]> {
  try {
    const res = await fetch(`${WAR_API_BASE}/maps/${hexName}/dynamic/public`);
    if (!res.ok) return [];
    const data: WarApiDynamicResponse = await res.json();
    const pois: WarPoi[] = [];
    for (const item of data.mapItems ?? []) {
      const pixel = hexItemToPixel(hexName, item.x, item.y);
      if (!pixel) continue;
      pois.push({
        hex: hexName,
        teamId: item.teamId,
        iconType: item.iconType,
        x: pixel.x,
        y: pixel.y,
        fracX: item.x,
        fracY: item.y,
      });
    }
    return pois;
  } catch {
    return [];
  }
}

/** Fetch points of interest for every known hex, in parallel. */
export async function fetchWarPois(): Promise<WarPoi[]> {
  const hexNames = Object.keys(HEX_AXIAL);
  const results = await Promise.all(hexNames.map(fetchHexPois));
  return results.flat();
}
