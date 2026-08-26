/* ── Collaborative map session API (REST) ─────────────────────────── */

import client from "./client";

export interface MapSessionInfo {
  id: string;
  code: string;
  created_at: string;
  updated_at: string;
}

export async function createMapSession(): Promise<MapSessionInfo> {
  const { data } = await client.post<MapSessionInfo>("/map/sessions");
  return data;
}

export async function getMapSession(code: string): Promise<MapSessionInfo> {
  const { data } = await client.get<MapSessionInfo>(`/map/sessions/${code}`);
  return data;
}
