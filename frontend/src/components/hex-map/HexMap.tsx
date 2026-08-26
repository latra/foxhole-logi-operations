/* ── Interactive SVG hex map ──────────────────────────────────────── */

import { useMemo } from "react";
import { HEX_REGIONS, hexToPixel } from "./hexMapData";
import HexRegion from "./HexRegion";

interface Props {
  selectedRegion: string | null;
  onSelectRegion: (name: string | null) => void;
}

const HEX_SIZE = 42; // radius in px

export default function HexMap({ selectedRegion, onSelectRegion }: Props) {
  /* Precompute positions and bounding box */
  const { positioned, viewBox } = useMemo(() => {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    const positioned = HEX_REGIONS.map((r) => {
      const { x, y } = hexToPixel(r.col, r.row, HEX_SIZE);
      if (x - HEX_SIZE < minX) minX = x - HEX_SIZE;
      if (y - HEX_SIZE < minY) minY = y - HEX_SIZE;
      if (x + HEX_SIZE > maxX) maxX = x + HEX_SIZE;
      if (y + HEX_SIZE > maxY) maxY = y + HEX_SIZE;
      return { ...r, x, y };
    });

    const pad = 10;
    const viewBox = `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`;
    return { positioned, viewBox };
  }, []);

  /* Mobile fallback: dropdown */
  const isMobile = typeof window !== "undefined" && window.innerWidth < 600;

  if (isMobile) {
    const sorted = [...HEX_REGIONS].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    return (
      <select
        className="browser-default"
        value={selectedRegion ?? ""}
        onChange={(e) =>
          onSelectRegion(e.target.value || null)
        }
        style={{ width: "100%" }}
      >
        <option value="">— Select region —</option>
        {sorted.map((r) => (
          <option key={r.name} value={r.name}>
            {r.name}
          </option>
        ))}
      </select>
    );
  }

  return (
    <svg
      viewBox={viewBox}
      style={{
        width: "100%",
        maxHeight: 520,
        display: "block",
      }}
    >
      {positioned.map((r) => (
        <HexRegion
          key={r.name}
          name={r.name}
          cx={r.x}
          cy={r.y}
          size={HEX_SIZE}
          isSelected={selectedRegion === r.name}
          onSelect={() =>
            onSelectRegion(selectedRegion === r.name ? null : r.name)
          }
        />
      ))}
    </svg>
  );
}
