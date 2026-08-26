/* ── Hook: regions for a war ──────────────────────────────────────── */

import { useEffect, useState } from "react";
import type { Region } from "../types/models";
import { listRegions } from "../api/catalog";

export function useRegions(warId: number | null | undefined) {
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!warId) return;
    let cancelled = false;
    setLoading(true);
    listRegions(warId)
      .then((r) => {
        if (!cancelled) setRegions(r);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [warId]);

  return { regions, loading };
}
