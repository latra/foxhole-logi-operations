/* ── Hook: auth convenience ───────────────────────────────────────── */

import { useAuthStore } from "../stores/authStore";

export function useAuth() {
  const jwt = useAuthStore((s) => s.jwt);
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const logout = useAuthStore((s) => s.logout);

  return {
    isAuthenticated: !!jwt && !!user,
    user,
    loading,
    logout,
  };
}
