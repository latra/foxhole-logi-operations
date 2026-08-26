/* ── Static Foxhole hex region data ──────────────────────────────── */

export interface HexRegionData {
  name: string;
  col: number;
  row: number;
}

/**
 * All 53 Foxhole hex regions with approximate grid positions.
 * Layout is an offset-coordinate hex grid (odd-row shifted right).
 * Rows 0–9, columns 0–7 (irregular — not all cells filled).
 */
export const HEX_REGIONS: HexRegionData[] = [
  // Row 0
  { name: "Olavi's Wake",       col: 3, row: 0 },
  { name: "Kuura Strand",       col: 4, row: 0 },
  { name: "Kalokai",            col: 5, row: 0 },

  // Row 1
  { name: "Warden Home Region", col: 2, row: 1 },
  { name: "Tyrant Foothills",   col: 3, row: 1 },
  { name: "Reaching Trail",     col: 4, row: 1 },
  { name: "Basin Sionnach",     col: 5, row: 1 },
  { name: "Callum's Cape",      col: 6, row: 1 },

  // Row 2
  { name: "Stema Landing",      col: 1, row: 2 },
  { name: "Nevish Line",        col: 2, row: 2 },
  { name: "Callahan's Passage", col: 3, row: 2 },
  { name: "Marban Hollow",      col: 4, row: 2 },
  { name: "Morgen's Crossing",  col: 5, row: 2 },
  { name: "Stonecradle",        col: 6, row: 2 },
  { name: "King's Cage",        col: 7, row: 2 },

  // Row 3
  { name: "Palantine Berm",     col: 1, row: 3 },
  { name: "Lykos Isle",         col: 2, row: 3 },
  { name: "Sableport",          col: 3, row: 3 },
  { name: "Ash Fields",         col: 4, row: 3 },
  { name: "The Heartlands",     col: 5, row: 3 },
  { name: "Loch Mor",           col: 6, row: 3 },
  { name: "The Linn of Mercy",  col: 7, row: 3 },

  // Row 4
  { name: "Piper's Enclave",    col: 1, row: 4 },
  { name: "Acrithia",           col: 2, row: 4 },
  { name: "The Moors",          col: 3, row: 4 },
  { name: "Deadlands",          col: 4, row: 4 },
  { name: "Umbral Wildwood",    col: 5, row: 4 },
  { name: "Godcrofts",          col: 6, row: 4 },
  { name: "Tempest Island",     col: 7, row: 4 },

  // Row 5
  { name: "Stlican Shelf",      col: 0, row: 5 },
  { name: "Onyx",               col: 1, row: 5 },
  { name: "Origin",             col: 2, row: 5 },
  { name: "Farranac Coast",     col: 3, row: 5 },
  { name: "Westgate",           col: 4, row: 5 },
  { name: "Endless Shore",      col: 5, row: 5 },
  { name: "Allod's Bight",      col: 6, row: 5 },
  { name: "The Fingers",        col: 7, row: 5 },

  // Row 6
  { name: "Wresta",             col: 1, row: 6 },
  { name: "Pari Peak",          col: 2, row: 6 },
  { name: "Shackled Chasm",     col: 3, row: 6 },
  { name: "Viper Pit",          col: 4, row: 6 },
  { name: "The Drowned Vale",   col: 5, row: 6 },
  { name: "The Oarbreaker Isles", col: 6, row: 6 },

  // Row 7
  { name: "Red River",          col: 2, row: 7 },
  { name: "Speaking Woods",     col: 3, row: 7 },
  { name: "Howl County",        col: 4, row: 7 },
  { name: "Great March",        col: 5, row: 7 },
  { name: "Weathered Expanse",  col: 6, row: 7 },
  { name: "Fisherman's Row",    col: 7, row: 7 },

  // Row 8
  { name: "The Clahstra",       col: 2, row: 8 },
  { name: "The Gutter",         col: 3, row: 8 },
  { name: "Clanshead Valley",   col: 4, row: 8 },
  { name: "Reaver's Pass",      col: 5, row: 8 },
  { name: "Terminus",           col: 6, row: 8 },

  // Row 9
  { name: "Colonial Home Region", col: 3, row: 9 },
];

/**
 * Compute the pixel center of a flat-top hex given grid coords.
 * Odd rows are shifted right by half a hex width.
 */
export function hexToPixel(
  col: number,
  row: number,
  size: number
): { x: number; y: number } {
  const w = size * 2;          // flat-top hex width
  const h = Math.sqrt(3) * size; // hex height
  const xOffset = row % 2 === 1 ? w * 0.75 : 0;
  const x = col * w * 1.5 + xOffset + size;
  const y = row * h + h / 2;
  return { x, y };
}

/**
 * Generate SVG polygon points for a flat-top hexagon.
 */
export function hexPoints(cx: number, cy: number, size: number): string {
  const points: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    const px = cx + size * Math.cos(angle);
    const py = cy + size * Math.sin(angle);
    points.push(`${px},${py}`);
  }
  return points.join(" ");
}
