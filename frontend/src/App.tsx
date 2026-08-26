/* ── Root application component ───────────────────────────────────── */

import { useEffect } from "react";
import AppRouter from "./router";
import { useAuthStore } from "./stores/authStore";

export default function App() {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <div className="foxhole-app">
      <AppRouter />
    </div>
  );
}
