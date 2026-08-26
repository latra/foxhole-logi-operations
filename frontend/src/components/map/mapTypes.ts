/* ── Shape types for the collaborative map drawing ───────────────── */

export type ShapeType = "line" | "arrow" | "rect" | "triangle" | "circle" | "text" | "stamp-rect" | "stamp-triangle";

export interface Point {
  x: number;
  y: number;
}

export interface MapShape {
  id: string;
  type: ShapeType;
  /** Start point (or center for circle) */
  p1: Point;
  /** End point (or edge for circle) */
  p2: Point;
  color: string;
  strokeWidth: number;
  /** Only used for text shapes */
  text?: string;
  /** Author peer id */
  author: string;
}

/** A user currently connected to a map session. */
export interface PresenceUser {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

/** Messages exchanged over the map session WebSocket (see backend routes/map_router.py). */
export type MapSessionMessage =
  | { kind: "full-state"; shapes: MapShape[] }
  | { kind: "shape-add"; shape: MapShape }
  | { kind: "shape-remove"; shapeId: string }
  | { kind: "clear-all" }
  | { kind: "undo"; shapeId: string }
  | { kind: "presence"; users: PresenceUser[] };

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
