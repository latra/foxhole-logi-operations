/* ── Auth Store (Zustand) ─────────────────────────────────────────── */

import { create } from "zustand";
import type { User } from "../types/models";
import { getMe } from "../api/auth";

interface AuthState {
  jwt: string | null;
  user: User | null;
  loading: boolean;

  setJwt: (jwt: string) => void;
  setUser: (user: User) => void;
  logout: () => void;

  /** Try to restore session from localStorage */
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  jwt: localStorage.getItem("jwt"),
  user: null,
  loading: true,

  setJwt: (jwt: string) => {
    localStorage.setItem("jwt", jwt);
    set({ jwt });
  },

  setUser: (user: User) => set({ user }),

  logout: () => {
    localStorage.removeItem("jwt");
    set({ jwt: null, user: null });
  },

  hydrate: async () => {
    const jwt = get().jwt;
    if (!jwt) {
      set({ loading: false });
      return;
    }
    try {
      const user = await getMe();
      set({ user, loading: false });
    } catch {
      // Token invalid / expired
      localStorage.removeItem("jwt");
      set({ jwt: null, user: null, loading: false });
    }
  },
}));
