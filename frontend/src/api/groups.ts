/* ── Groups API ───────────────────────────────────────────────────── */

import client from "./client";
import type { Group, GroupMembership } from "../types/models";

export interface GroupCreatePayload {
  name: string;
  tag: string;
  faction: string;
  discord_guild_id: string;
  discord_member_role_id?: string | null;
}

export async function listGroups(): Promise<Group[]> {
  const { data } = await client.get<Group[]>("/groups");
  return data;
}

export async function getGroup(id: string): Promise<Group> {
  const { data } = await client.get<Group>(`/groups/${id}`);
  return data;
}

export async function createGroup(payload: GroupCreatePayload): Promise<Group> {
  const { data } = await client.post<Group>("/groups", payload);
  return data;
}

/* ── Member management ───────────────────────────────────────────── */

export async function listMembers(
  groupId: string
): Promise<GroupMembership[]> {
  const { data } = await client.get<GroupMembership[]>(
    `/groups/${groupId}/members`
  );
  return data;
}

export async function requestJoin(
  groupId: string
): Promise<GroupMembership> {
  const { data } = await client.post<GroupMembership>(
    `/groups/${groupId}/members`
  );
  return data;
}

export async function acceptMember(
  groupId: string,
  membershipId: string
): Promise<GroupMembership> {
  const { data } = await client.post<GroupMembership>(
    `/groups/${groupId}/members/${membershipId}/accept`
  );
  return data;
}

export async function rejectMember(
  groupId: string,
  membershipId: string
): Promise<void> {
  await client.post(`/groups/${groupId}/members/${membershipId}/reject`);
}

export async function removeMember(
  groupId: string,
  membershipId: string
): Promise<void> {
  await client.delete(`/groups/${groupId}/members/${membershipId}`);
}

export async function updateMemberRole(
  groupId: string,
  membershipId: string,
  role: string
): Promise<GroupMembership> {
  const { data } = await client.patch<GroupMembership>(
    `/groups/${groupId}/members/${membershipId}`,
    { role }
  );
  return data;
}

export async function deleteGroup(groupId: string): Promise<void> {
  await client.delete(`/groups/${groupId}`);
}
