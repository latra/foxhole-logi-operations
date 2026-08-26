/* ── Map-based location picker/viewer for stockpiles ──────────────────
 *
 * "pick" mode: shows only stockpile-relevant structures (Storage Depot,
 * Seaport, Bunker Base, Keep, Town Base) from the live War API layer;
 * clicking one resolves its region + structure type back to the caller.
 * "view" mode: re-plots a previously picked (hex, fracX, fracY) location
 * with a highlight ring and centers the camera on it.
 */

import { useCallback, useEffect, useState } from "react";
import MapCanvas from "../map/MapCanvas";
import { createShapeStore } from "../map/mapStore";
import {
  FACTION_COLORS,
  fetchWarPois,
  hexDisplayName,
  isStockpileStructureIcon,
  poiFromFraction,
  stockpileStructureForIconType,
  type WarPoi,
} from "../map/warPois";

// Isolated, always-empty shape store — this canvas is read-only (pan/zoom only).
const pickerStore = createShapeStore();

export interface StockpilePickResult {
  hex: string;
  regionName: string;
  structureType: string | null;
  x: number;
  y: number;
}

interface PickProps {
  mode: "pick";
  onSelect: (result: StockpilePickResult) => void;
  onClose: () => void;
}

interface ViewProps {
  mode: "view";
  location: { hex: string; x: number; y: number };
  onClose: () => void;
}

type Props = PickProps | ViewProps;

const FACTION_LABEL: Record<string, string> = {
  WARDENS: "Warden",
  COLONIALS: "Colonial",
  NONE: "Neutral",
};

export default function StockpileMapPicker(props: Props) {
  const [pois, setPois] = useState<WarPoi[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchWarPois().then((all) => {
      if (cancelled) return;
      setPois(all.filter((p) => isStockpileStructureIcon(p.iconType)));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePoiClick = useCallback(
    (poi: WarPoi) => {
      if (props.mode !== "pick") return;
      props.onSelect({
        hex: poi.hex,
        regionName: hexDisplayName(poi.hex),
        structureType: stockpileStructureForIconType(poi.iconType),
        x: poi.fracX,
        y: poi.fracY,
      });
      props.onClose();
    },
    [props]
  );

  const selectedPoi =
    props.mode === "view"
      ? poiFromFraction(props.location.hex, props.location.x, props.location.y)
      : null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1100,
      }}
      onClick={props.onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius)",
          border: "1px solid rgba(219,218,216,0.12)",
          width: "min(1100px, 92vw)",
          height: "80vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "var(--border-subtle)",
          }}
        >
          <div>
            <div style={{ fontSize: 15, fontWeight: 500, color: "var(--color-light)" }}>
              {props.mode === "pick" ? "Pick a stockpile location" : "Stockpile location"}
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-dim)", marginTop: 2 }}>
              {props.mode === "pick"
                ? "Click a Storage Depot, Seaport, Bunker Base, Keep or Town Base on the map."
                : "Where this stockpile was picked on the map."}
            </div>
          </div>
          <button
            className="btn-flat"
            onClick={props.onClose}
            title="Close"
            style={{ padding: "0 4px", minWidth: "auto" }}
          >
            <i className="material-icons" style={{ fontSize: 20 }}>close</i>
          </button>
        </div>

        {/* Faction legend */}
        <div
          style={{
            display: "flex",
            gap: 14,
            padding: "8px 16px",
            fontSize: 11,
            color: "var(--color-text-dim)",
            borderBottom: "var(--border-subtle)",
          }}
        >
          {(["WARDENS", "COLONIALS", "NONE"] as const).map((f) => (
            <span key={f} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: FACTION_COLORS[f],
                }}
              />
              {FACTION_LABEL[f]}
            </span>
          ))}
        </div>

        <div style={{ flex: 1, position: "relative", display: "flex" }}>
          {loading ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--color-text-dim)",
              }}
            >
              Loading map…
            </div>
          ) : (
            <MapCanvas
              activeTool="line"
              activeColor="#e74c3c"
              strokeWidth={3}
              peerId="stockpile-picker"
              onShapeAdded={() => {}}
              store={pickerStore}
              readOnly
              warPois={pois}
              showWarLayer
              onPoiClick={props.mode === "pick" ? handlePoiClick : undefined}
              selectedPoi={selectedPoi}
            />
          )}
        </div>
      </div>
    </div>
  );
}
