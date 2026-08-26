/* ── Resolve a group member's user id to display info (name + avatar) ── */

import type { GroupMembership } from "../types/models";

export interface UserInfo {
  name: string;
  avatarUrl: string | null;
}

export function buildUserInfoMap(memberships: GroupMembership[]): Map<string, UserInfo> {
  const map = new Map<string, UserInfo>();
  for (const m of memberships) {
    map.set(m.user_id, {
      name: m.user?.display_name ?? m.user?.username ?? "Unknown",
      avatarUrl: m.user?.avatar_url ?? null,
    });
  }
  return map;
}
