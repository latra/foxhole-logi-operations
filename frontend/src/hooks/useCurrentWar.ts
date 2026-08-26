/* ── Hook: current war ───────────────────────────────────────────── */

import { useEffect, useState } from "react";
import type { War } from "../types/models";
import { getCurrentWar } from "../api/catalog";

export function useCurrentWar() {
  const [war, setWar] = useState<War | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getCurrentWar()
      .then((w) => {
        if (!cancelled) setWar(w);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { war, loading };
}
