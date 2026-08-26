/* ── Catalog API (wars, regions, vehicles, items, map) ───────────── */

import client from "./client";
import type {
  War,
  Region,
  VehicleDefinition,
  FoxholeItem,
  CatalogItem,
  CatalogVehicleType,
} from "../types/models";

export async function getCurrentWar(): Promise<War> {
  const { data } = await client.get<War>("/wars/current");
  return data;
}

export async function listRegions(warId: number): Promise<Region[]> {
  const { data } = await client.get<Region[]>("/regions", {
    params: { war_id: warId },
  });
  return data;
}

export interface CreateRegionPayload {
  war_id: number;
  name: string;
  hex_code?: string | null;
}

export async function createRegion(payload: CreateRegionPayload): Promise<Region> {
  const { data } = await client.post<Region>("/regions", payload);
  return data;
}

/* ── Backend catalog (items / vehicle types) ──────────────────────── */
/*
 * These are the app's own reference tables — resource/vehicle requests
 * are foreign-keyed to CatalogItem.id / CatalogVehicleType.id. Items are
 * now served entirely from our own API (see toFoxholeItem below, used by
 * logisticsStore to shape them for the catalog UI); vehicle types still get
 * lazily populated (by code) from the local vehicle definitions the first
 * time one is used — see logisticsStore.resolveVehicleTypeId.
 */

export interface CreateCatalogItemPayload {
  code: string;
  name: string;
  category: string;
  faction: string;
  stack_size: number;
  crate_size: number;
  produced_at: string;
  icon_url?: string | null;
}

export async function listBackendItems(): Promise<CatalogItem[]> {
  const { data } = await client.get<CatalogItem[]>("/items");
  return data;
}

export async function createBackendItem(
  payload: CreateCatalogItemPayload,
): Promise<CatalogItem> {
  const { data } = await client.post<CatalogItem>("/items", payload);
  return data;
}

export interface CreateCatalogVehicleTypePayload {
  code: string;
  name: string;
  category: string;
  faction: string;
  produced_at: string;
  cargo_slots?: number | null;
  icon_url?: string | null;
}

export async function listBackendVehicleTypes(): Promise<CatalogVehicleType[]> {
  const { data } = await client.get<CatalogVehicleType[]>("/vehicle-types");
  return data;
}

export async function createBackendVehicleType(
  payload: CreateCatalogVehicleTypePayload,
): Promise<CatalogVehicleType> {
  const { data } = await client.post<CatalogVehicleType>("/vehicle-types", payload);
  return data;
}

const FACTION_ENUM_TO_CODE: Record<string, "W" | "C" | "N"> = {
  WARDEN: "W",
  COLONIAL: "C",
  NEUTRAL: "N",
};

/** Maps a backend catalog item onto the shape the catalog UI components expect. */
export function toFoxholeItem(item: CatalogItem): FoxholeItem {
  return {
    itemName: item.name,
    displayId: item.code,
    categoryName: item.category,
    description: "",
    iconPath: item.icon_url ?? "",
    faction: FACTION_ENUM_TO_CODE[item.faction] ?? "N",
  };
}

/* ── Vehicle definitions (bundled local JSON — see data/vehicleDefinitions.json) ── */
/*
 * There's no official or community API for vehicle inventory slot counts
 * (see docs/logistics_list_spec.md §2.2), so this ships as a local file
 * maintained alongside the codebase rather than fetched over the network.
 */

import vehicleDefinitionsData from "../data/vehicleDefinitions.json";

export async function getVehicleDefinitions(): Promise<VehicleDefinition[]> {
  return vehicleDefinitionsData as VehicleDefinition[];
}

/* ── Map locations (Foxhole War API static map data) ─────────────── */

interface WarApiMapTextItem {
  text: string;
  x: number;
  y: number;
  mapMarkerType: string;
}

interface WarApiStaticResponse {
  regionId: number;
  mapTextItems: WarApiMapTextItem[];
}

const WAR_API_BASE = "https://war-service-live.foxholeservices.com/api";

export async function getMapLocations(): Promise<string[]> {
  try {
    const mapsRes = await fetch(`${WAR_API_BASE}/worldconquest/maps`);
    if (!mapsRes.ok) return [];
    const mapNames: string[] = await mapsRes.json();

    const locations: string[] = [];
    // Fetch static data for each region in parallel (batched)
    const staticPromises = mapNames.map(async (mapName) => {
      try {
        const res = await fetch(
          `${WAR_API_BASE}/worldconquest/maps/${mapName}/static`,
        );
        if (!res.ok) return [];
        const data: WarApiStaticResponse = await res.json();
        return (data.mapTextItems ?? [])
          .filter((item) => item.text && item.text.trim().length > 0)
          .map((item) => item.text.trim());
      } catch {
        return [];
      }
    });

    const results = await Promise.all(staticPromises);
    for (const regionLocations of results) {
      locations.push(...regionLocations);
    }

    // Deduplicate and sort
    return [...new Set(locations)].sort();
  } catch {
    return [];
  }
}
