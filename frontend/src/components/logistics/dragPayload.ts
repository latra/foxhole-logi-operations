/* ── Drag-and-drop payload shared by slots + catalog tiles ─────────── */

export type DragPayload =
  | { kind: "existing"; orderItemId: string }
  | { kind: "existing-multi"; orderItemIds: string[] }
  | { kind: "catalog"; displayId: string };
