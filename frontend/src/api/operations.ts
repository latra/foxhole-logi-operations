/* ── Operations API ───────────────────────────────────────────────── */

import client, { API_BASE_URL } from "./client";
import type { Operation, OperationSignup, Group } from "../types/models";
import type { MapShape } from "../components/map/mapTypes";

export interface OperationCreatePayload {
  group_id: string;
  war_id: number;
  name: string;
  description?: string | null;
  scheduled_at: string; // ISO 8601
  duration_minutes?: number | null;
  region_id?: number | null;
  location_detail?: string | null;
  invited_group_ids?: string[];
  plan_shapes?: MapShape[] | null;
}

export interface OperationUpdatePayload {
  name?: string;
  description?: string | null;
  scheduled_at?: string;
  duration_minutes?: number | null;
  region_id?: number | null;
  location_detail?: string | null;
  status?: string;
  debrief?: string | null;
}

export async function listOperations(groupId?: string): Promise<Operation[]> {
  const params: Record<string, string> = {};
  if (groupId) params.group_id = groupId;
  const { data } = await client.get<Operation[]>("/operations", { params });
  return data;
}

export async function getOperation(id: string): Promise<Operation> {
  const { data } = await client.get<Operation>(`/operations/${id}`);
  return data;
}

export async function createOperation(
  payload: OperationCreatePayload
): Promise<Operation> {
  const { data } = await client.post<Operation>("/operations", payload);
  return data;
}

export async function updateOperation(
  id: string,
  payload: OperationUpdatePayload
): Promise<Operation> {
  const { data } = await client.patch<Operation>(`/operations/${id}`, payload);
  return data;
}

export async function deleteOperation(id: string): Promise<void> {
  await client.delete(`/operations/${id}`);
}

/* ── Group search by faction ─────────────────────────────────────── */

export async function searchGroupsByFaction(
  faction: string,
  q?: string
): Promise<Group[]> {
  const params: Record<string, string> = { faction };
  if (q) params.q = q;
  const { data } = await client.get<Group[]>("/operations/groups/search", {
    params,
  });
  return data;
}

/* ── Signups ──────────────────────────────────────────────────────── */

export async function listSignups(
  operationId: string
): Promise<OperationSignup[]> {
  const { data } = await client.get<OperationSignup[]>(
    `/operations/${operationId}/signups`
  );
  return data;
}

export async function createSignup(
  operationId: string,
  status: "ATTENDING" | "ARRIVING_LATE"
): Promise<OperationSignup> {
  const { data } = await client.post<OperationSignup>(
    `/operations/${operationId}/signups`,
    { status }
  );
  return data;
}

export async function updateSignup(
  operationId: string,
  signupId: string,
  payload: { status: string }
): Promise<OperationSignup> {
  const { data } = await client.patch<OperationSignup>(
    `/operations/${operationId}/signups/${signupId}`,
    payload
  );
  return data;
}

export async function deleteSignup(
  operationId: string,
  signupId: string
): Promise<void> {
  await client.delete(`/operations/${operationId}/signups/${signupId}`);
}

/* ── Live plan WebSocket ─────────────────────────────────────────── */

export function getPlanSocketUrl(operationId: string): string {
  const wsBase = API_BASE_URL.replace(/^http/, "ws");
  const jwt = localStorage.getItem("jwt") ?? "";
  return `${wsBase}/operations/${operationId}/plan/ws?token=${encodeURIComponent(jwt)}`;
}
