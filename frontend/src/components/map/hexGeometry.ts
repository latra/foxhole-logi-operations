/* ── Foxhole hex-grid geometry: game-world axial coords → canvas pixels ──
 *
 * Foxhole's world map is a grid of 53 hexagonal regions. The War API's
 * per-hex mapItems give item positions as a fraction (0..1) across/down
 * their own hex, not a global pixel — to place them on our single
 * composite map image (see MAP_W/MAP_H in MapCanvas.tsx) we need each
 * hex's axial grid coordinate and a world→pixel projection.
 *
 * The axial coordinates and world-space hex formula below are the ones
 * used by community War API tooling (e.g. Snappey/Foxhole-Map's
 * hex-coordinate.service.ts), which covers 43 of the 53 hexes. The
 * remaining 10 — mostly small outer-ring/island regions not covered by
 * that table (Kuura Strand, The Gutter, Pari Peak, Olavi's Wake,
 * Palantine Berm, Lykos Isle, Wresta, Tyrant Foothills, Onyx, Piper's
 * Enclave) — were inferred by extending the same axial grid to match
 * their position in this project's own map-tiles composite image, so
 * their placement is approximate.
 *
 * The projection constants (SCALE_X/Y, OFFSET_X/Y) were fit by least
 * squares against ~29 hexes whose pixel centers were read directly off
 * /public/map-tiles/map-preview.webp — max residual under 2px on the
 * 1280px preview (under 16px at full MAP_W resolution).
 */

export const HEX_AXIAL: Record<string, [number, number]> = {
  DeadLandsHex: [0, 0],
  CallahansPassageHex: [0, 1],
  MarbanHollow: [1, 0],
  DrownedValeHex: [1, -1],
  UmbralWildwoodHex: [0, -1],
  LochMorHex: [-1, -1],
  LinnMercyHex: [-1, 0],
  KingsCageHex: [-2, 0],
  SableportHex: [-2, -1],
  HeartlandsHex: [-1, -2],
  WestgateHex: [-3, -1],
  OriginHex: [-3, -2],
  AshFieldsHex: [-2, -2],
  RedRiverHex: [-1, -3],
  GreatMarchHex: [0, -2],
  KalokaiHex: [0, -3],
  AcrithiaHex: [1, -3],
  ShackledChasmHex: [1, -2],
  TerminusHex: [2, -2],
  AllodsBightHex: [2, -1],
  ReaversPassHex: [3, -2],
  TheFingersHex: [4, -1],
  EndlessShoreHex: [3, -1],
  ClahstraHex: [2, 0],
  StlicanShelfHex: [3, 0],
  TempestIslandHex: [4, 0],
  MorgensCrossingHex: [3, 1],
  WeatheredExpanseHex: [2, 1],
  ViperPitHex: [1, 1],
  ClansheadValleyHex: [2, 2],
  HowlCountyHex: [1, 2],
  BasinSionnachHex: [0, 3],
  ReachingTrailHex: [0, 2],
  SpeakingWoodsHex: [-1, 2],
  MooringCountyHex: [-1, 1],
  GodcroftsHex: [4, 1],
  CallumsCapeHex: [-2, 2],
  StonecradleHex: [-2, 1],
  NevishLineHex: [-3, 1],
  FarranacCoastHex: [-3, 0],
  OarbreakerHex: [-4, 1],
  FishermansRowHex: [-4, 0],
  StemaLandingHex: [-4, -1],

  // Inferred (see module doc comment above) — approximate placement.
  KuuraStrandHex: [-4, 2],
  GutterHex: [-5, -1],
  PariPeakHex: [-5, 1],
  OlavisWakeHex: [-6, 1],
  PalantineBermHex: [-5, 0],
  LykosIsleHex: [5, 0],
  WrestaHex: [5, -1],
  TyrantFoothillsHex: [5, -2],
  OnyxHex: [4, -2],
  PipersEnclaveHex: [6, -1],
};

/* ── Foxhole world-space hex geometry (game units) ───────────────────── */
const HEX_SIZE = 4680;
const HEX_WIDTH = HEX_SIZE * 2;
const HEX_WIDTH_QTR = HEX_WIDTH / 4;
const HEX_HEIGHT = HEX_SIZE * Math.sqrt(3);
const WORLD_CENTER = 32770;

function hexOffset(x: number): number {
  if (x === 0) return 0;
  return x > 0 ? -HEX_WIDTH_QTR * Math.abs(x) : HEX_WIDTH_QTR * Math.abs(x);
}

function worldCoordinates(axialX: number, axialY: number): [number, number] {
  const isEvenQ = axialX % 2 === 0;
  return [
    WORLD_CENTER + axialX * HEX_WIDTH + hexOffset(axialX),
    WORLD_CENTER + axialY * HEX_HEIGHT + (isEvenQ ? 0 : HEX_HEIGHT / 2),
  ];
}

/* ── World → this project's map-tiles canvas pixel space ─────────────── */
const SCALE_X = 0.10938964395248549;
const OFFSET_X = 1527.8560124857938;
const SCALE_Y = -0.10900046223998053;
const OFFSET_Y = 6673.523120313715;
const HEX_HALF_WIDTH_PX = HEX_SIZE * SCALE_X;
const HEX_HALF_HEIGHT_PX = ((HEX_SIZE * Math.sqrt(3)) / 2) * Math.abs(SCALE_Y);

export function hexPixelCenter(hexName: string): { x: number; y: number } | null {
  const axial = HEX_AXIAL[hexName];
  if (!axial) return null;
  const [wx, wy] = worldCoordinates(axial[0], axial[1]);
  return { x: wx * SCALE_X + OFFSET_X, y: wy * SCALE_Y + OFFSET_Y };
}

/**
 * Convert a War API mapItem's fractional position within its hex
 * (x,y each 0..1, left-to-right / top-to-bottom) into canvas pixel
 * coordinates on the composite map image.
 */
export function hexItemToPixel(
  hexName: string,
  fracX: number,
  fracY: number
): { x: number; y: number } | null {
  const center = hexPixelCenter(hexName);
  if (!center) return null;
  return {
    x: center.x - HEX_HALF_WIDTH_PX + fracX * HEX_HALF_WIDTH_PX * 2,
    y: center.y - HEX_HALF_HEIGHT_PX + fracY * HEX_HALF_HEIGHT_PX * 2,
  };
}

/* ── Real-world scale ──────────────────────────────────────────────────
 * Per the Foxhole wiki, each hex Region is 2.184 km wide by 1.890 km
 * tall — the same width/height convention as HEX_HALF_WIDTH_PX/
 * HEX_HALF_HEIGHT_PX above, so those give us meters-per-pixel directly.
 * The x/y calibration fit isn't perfectly isotropic (see module doc),
 * so the two axes get very slightly different meters-per-pixel — using
 * each axis's own value keeps distance/bearing measurements accurate
 * instead of assuming a single uniform scale. */
const HEX_REAL_WIDTH_M = 2184;
const HEX_REAL_HEIGHT_M = 1890;

export const METERS_PER_PIXEL_X = HEX_REAL_WIDTH_M / (HEX_HALF_WIDTH_PX * 2);
export const METERS_PER_PIXEL_Y = HEX_REAL_HEIGHT_M / (HEX_HALF_HEIGHT_PX * 2);

/** Real-world distance, in meters, spanned by a canvas-pixel delta. */
export function pixelDistanceMeters(dxPx: number, dyPx: number): number {
  const dxM = dxPx * METERS_PER_PIXEL_X;
  const dyM = dyPx * METERS_PER_PIXEL_Y;
  return Math.hypot(dxM, dyM);
}

/** Compass bearing in degrees (0 = north, 90 = east, clockwise) for a canvas-pixel delta. */
export function pixelBearingDegrees(dxPx: number, dyPx: number): number {
  const dxM = dxPx * METERS_PER_PIXEL_X;
  const dyM = dyPx * METERS_PER_PIXEL_Y;
  const deg = (Math.atan2(dxM, -dyM) * 180) / Math.PI;
  return deg < 0 ? deg + 360 : deg;
}
