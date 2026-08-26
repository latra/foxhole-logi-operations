/* ── Operation Store (Zustand) ────────────────────────────────────── */

import { create } from "zustand";
import type { Operation, OperationSignup } from "../types/models";
import { listOperations, listSignups } from "../api/operations";

interface OperationState {
  operations: Operation[];
  selectedOperation: Operation | null;
  signups: OperationSignup[];
  loading: boolean;
  signupsLoading: boolean;

  fetchOperations: (groupId?: string) => Promise<void>;
  selectOperation: (op: Operation | null) => Promise<void>;
  clearSelection: () => void;
  reset: () => void;
}

export const useOperationStore = create<OperationState>((set) => ({
  operations: [],
  selectedOperation: null,
  signups: [],
  loading: false,
  signupsLoading: false,

  fetchOperations: async (groupId?: string) => {
    set({ loading: true });
    try {
      const operations = await listOperations(groupId);
      set({ operations, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  selectOperation: async (op: Operation | null) => {
    set({ selectedOperation: op, signups: [] });
    if (op) {
      set({ signupsLoading: true });
      try {
        const signups = await listSignups(op.id);
        set({ signups, signupsLoading: false });
      } catch {
        set({ signupsLoading: false });
      }
    }
  },

  clearSelection: () => set({ selectedOperation: null, signups: [] }),

  reset: () =>
    set({
      operations: [],
      selectedOperation: null,
      signups: [],
      loading: false,
      signupsLoading: false,
    }),
}));
