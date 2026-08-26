/* ── Group Store (Zustand) ────────────────────────────────────────── */

import { create } from "zustand";
import type { Group, GroupMembership } from "../types/models";
import { listGroups, listMembers } from "../api/groups";

interface GroupState {
  groups: Group[];
  memberships: GroupMembership[];
  activeGroup: Group | null;
  loading: boolean;

  fetchGroups: () => Promise<void>;
  fetchMemberships: (userId: string) => Promise<void>;
  setActiveGroup: (group: Group | null) => void;
  reset: () => void;
}

export const useGroupStore = create<GroupState>((set, get) => ({
  groups: [],
  memberships: [],
  activeGroup: null,
  loading: false,

  fetchGroups: async () => {
    set({ loading: true });
    try {
      const groups = await listGroups();
      set({ groups, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  fetchMemberships: async (userId: string) => {
    // For each group, check if the user is a member
    const { groups } = get();
    const allMemberships: GroupMembership[] = [];
    for (const group of groups) {
      try {
        const members = await listMembers(group.id);
        const mine = members.filter(
          (m) => m.user_id === userId && (m.status === "ACTIVE" || m.status === "PENDING"),
        );
        allMemberships.push(...mine);
      } catch {
        // Skip group if we can't fetch members
      }
    }
    const activeMembership = allMemberships.find((m) => m.status === "ACTIVE") ?? allMemberships[0];
    const activeGroup =
      activeMembership
        ? groups.find((g) => g.id === activeMembership.group_id) ?? null
        : null;
    set({ memberships: allMemberships, activeGroup });
  },

  setActiveGroup: (group) => set({ activeGroup: group }),

  reset: () =>
    set({ groups: [], memberships: [], activeGroup: null, loading: false }),
}));
