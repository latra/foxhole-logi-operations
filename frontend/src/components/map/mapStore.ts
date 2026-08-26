/* ── Zustand store for collaborative shape-drawing state ──────────── */

import { create, type UseBoundStore, type StoreApi } from "zustand";
import type { MapShape } from "./mapTypes";

export interface ShapeState {
  shapes: MapShape[];
  /** Stack of removed shape ids for undo */
  undoStack: string[];

  addShape: (shape: MapShape) => void;
  updateShape: (id: string, patch: Partial<MapShape>) => void;
  removeShape: (id: string) => void;
  undoLast: (authorId: string) => MapShape | null;
  clearAll: () => void;
  /** Replace entire state (used when joining a session) */
  loadState: (shapes: MapShape[]) => void;
}

export type ShapeStore = UseBoundStore<StoreApi<ShapeState>>;

/** Factory so unrelated features (war map, operation plans) get isolated stores. */
export function createShapeStore(): ShapeStore {
  return create<ShapeState>((set, get) => ({
    shapes: [],
    undoStack: [],

    addShape: (shape) =>
      set((s) => ({ shapes: [...s.shapes, shape] })),

    updateShape: (id, patch) =>
      set((s) => ({
        shapes: s.shapes.map((sh) => (sh.id === id ? { ...sh, ...patch } : sh)),
      })),

    removeShape: (id) =>
      set((s) => ({ shapes: s.shapes.filter((sh) => sh.id !== id) })),

    undoLast: (authorId) => {
      const { shapes } = get();
      // Find the last shape by this author
      for (let i = shapes.length - 1; i >= 0; i--) {
        if (shapes[i].author === authorId) {
          const removed = shapes[i];
          set((s) => ({
            shapes: s.shapes.filter((sh) => sh.id !== removed.id),
            undoStack: [...s.undoStack, removed.id],
          }));
          return removed;
        }
      }
      return null;
    },

    clearAll: () => set({ shapes: [], undoStack: [] }),

    loadState: (shapes) => set({ shapes, undoStack: [] }),
  }));
}

export const useMapStore = createShapeStore();
