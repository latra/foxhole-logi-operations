/* ── Single hex polygon component ─────────────────────────────────── */

import { hexPoints } from "./hexMapData";

interface Props {
  name: string;
  cx: number;
  cy: number;
  size: number;
  isSelected: boolean;
  onSelect: () => void;
}

export default function HexRegion({
  name,
  cx,
  cy,
  size,
  isSelected,
  onSelect,
}: Props) {
  const points = hexPoints(cx, cy, size);

  // Truncate long names for display
  const label =
    name.length > 14 ? name.slice(0, 12) + "…" : name;

  return (
    <g onClick={onSelect} style={{ cursor: "pointer" }}>
      <title>{name}</title>
      <polygon
        points={points}
        fill={
          isSelected
            ? "rgba(36,86,130,0.25)"
            : "rgba(36,86,130,0.06)"
        }
        stroke={
          isSelected ? "#245682" : "rgba(219,218,216,0.10)"
        }
        strokeWidth={isSelected ? 1.5 : 1}
        onMouseEnter={(e) => {
          if (!isSelected) {
            (e.target as SVGPolygonElement).setAttribute(
              "fill",
              "rgba(36,86,130,0.15)"
            );
            (e.target as SVGPolygonElement).setAttribute(
              "stroke",
              "rgba(91,128,160,0.30)"
            );
          }
        }}
        onMouseLeave={(e) => {
          if (!isSelected) {
            (e.target as SVGPolygonElement).setAttribute(
              "fill",
              "rgba(36,86,130,0.06)"
            );
            (e.target as SVGPolygonElement).setAttribute(
              "stroke",
              "rgba(219,218,216,0.10)"
            );
          }
        }}
      />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fill={isSelected ? "var(--color-light)" : "var(--color-text-dim)"}
        fontSize={size > 35 ? 9 : 7}
        pointerEvents="none"
        style={{ userSelect: "none" }}
      >
        {label}
      </text>
    </g>
  );
}
