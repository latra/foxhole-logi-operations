/* ── Single-player map editor for operation plan images ───────────── */

import { useState, useCallback, useRef } from "react";
import MapCanvas from "../map/MapCanvas";
import type { MapCanvasHandle } from "../map/MapCanvas";
import type { ShapeType, ToolMode, MapShape } from "../map/mapTypes";
import { generateId } from "../map/mapTypes";
import { useOperationPlanStore } from "./planStore";
import { getMapSession } from "../../api/map";
import { toastSuccess, toastError } from "../common/Toast";

/* ── Toolbar (simplified: no session info, no disconnect) ────────── */

export const TOOLS: { type: ShapeType; icon: string; label: string }[] = [
  { type: "line", icon: "show_chart", label: "Line" },
  { type: "arrow", icon: "arrow_forward", label: "Arrow" },
  { type: "rect", icon: "crop_square", label: "Rectangle" },
  { type: "triangle", icon: "change_history", label: "Triangle" },
  { type: "circle", icon: "circle", label: "Circle" },
  { type: "text", icon: "text_fields", label: "Text" },
];

export const COLORS = [
  "#e74c3c", "#f39c12", "#f1c40f", "#2ecc71",
  "#3498db", "#9b59b6", "#ecf0f1", "#e91e63",
];

export const STROKE_WIDTHS = [2, 3, 5, 8];

interface Props {
  /** Called with the drawn shapes when the user confirms the plan */
  onSave: (shapes: MapShape[]) => void;
  onCancel: () => void;
  /** Pre-existing shapes to continue editing (e.g. redrawing before creation) */
  initialShapes?: MapShape[];
}

export default function PlanMapEditor({ onSave, onCancel, initialShapes }: Props) {
  const [activeTool, setActiveTool] = useState<ToolMode>("arrow");
  const [activeColor, setActiveColor] = useState(COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [showDistances, setShowDistances] = useState(false);
  const [mapCode, setMapCode] = useState("");
  const [loadingMap, setLoadingMap] = useState(false);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const mapCanvasRef = useRef<MapCanvasHandle>(null);

  // Seed the (isolated) plan store on mount
  const initializedRef = useRef(false);
  if (!initializedRef.current) {
    initializedRef.current = true;
    useOperationPlanStore.getState().loadState(initialShapes ?? []);
  }

  const handleUndo = useCallback(() => {
    useOperationPlanStore.getState().undoLast("plan-editor");
  }, []);

  const handleClear = useCallback(() => {
    useOperationPlanStore.getState().clearAll();
  }, []);

  const handleShapeAdded = useCallback((_shape: MapShape) => {
    // No-op in single player — shapes are already in the store
  }, []);

  const handleShapeUpdated = useCallback((_shape: MapShape) => {
    // No-op — the select tool already wrote the change into the store
  }, []);

  const handleShapeRemoved = useCallback((_shapeId: string) => {
    // No-op — already removed from the store
  }, []);

  const handleExportPng = useCallback(() => {
    mapCanvasRef.current?.exportPNG();
  }, []);

  /** Replace the current draft with another map's shapes — a starting
   *  point instead of drawing from scratch. Ids are regenerated so they
   *  never collide with anything drawn afterward. */
  const handleLoadMap = useCallback(async () => {
    const code = mapCode.trim();
    if (!code) return;
    setLoadingMap(true);
    try {
      const session = await getMapSession(code.toUpperCase());
      const shapes = (session.shapes ?? []).map((s) => ({ ...s, id: generateId() }));
      useOperationPlanStore.getState().loadState(shapes);
      toastSuccess(`Loaded ${shapes.length} shape${shapes.length === 1 ? "" : "s"} from map ${code.toUpperCase()}`);
    } catch {
      toastError("Map not found. Check the code and try again.");
    } finally {
      setLoadingMap(false);
    }
  }, [mapCode]);

  const handleSave = useCallback(() => {
    onSave(useOperationPlanStore.getState().shapes);
  }, [onSave]);

  // Handle Ctrl+Z for undo
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        handleUndo();
      }
    },
    [handleUndo]
  );

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        background: "var(--color-bg)",
      }}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 12px",
          background: "var(--color-surface)",
          borderBottom: "var(--border-subtle)",
          flexWrap: "wrap",
        }}
      >
        {/* Title */}
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-light)", marginRight: 4 }}>
          Operation Plan
        </span>

        <span style={{ width: 1, height: 24, background: "rgba(219,218,216,0.12)", margin: "0 4px" }} />

        {/* Select tool — move/resize/rotate/delete an existing shape */}
        <button
          className="btn-flat"
          title="Select (move, resize, rotate, delete a shape)"
          style={{
            width: 32, height: 32, padding: 0, minWidth: "auto",
            display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: 4, cursor: "pointer",
            background: activeTool === "select" ? "rgba(36,86,130,0.25)" : "transparent",
            color: activeTool === "select" ? "var(--color-light)" : "var(--color-text-dim)",
          }}
          onClick={() => setActiveTool("select")}
        >
          <i className="material-icons" style={{ fontSize: 18 }}>touch_app</i>
        </button>

        <span style={{ width: 1, height: 24, background: "rgba(219,218,216,0.12)", margin: "0 4px" }} />

        {/* Shape tools */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {TOOLS.map((t) => (
            <button
              key={t.type}
              className="btn-flat"
              title={t.label}
              style={{
                width: 32, height: 32, padding: 0, minWidth: "auto",
                display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: 4, cursor: "pointer",
                background: activeTool === t.type ? "rgba(36,86,130,0.25)" : "transparent",
                color: activeTool === t.type ? "var(--color-light)" : "var(--color-text-dim)",
              }}
              onClick={() => setActiveTool(t.type)}
            >
              <i className="material-icons" style={{ fontSize: 18 }}>{t.icon}</i>
            </button>
          ))}
        </div>

        <span style={{ width: 1, height: 24, background: "rgba(219,218,216,0.12)", margin: "0 4px" }} />

        {/* Colors */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {COLORS.map((c) => (
            <button
              key={c}
              style={{
                width: 20, height: 20, borderRadius: "50%", background: c,
                border: activeColor === c ? "2px solid var(--color-light)" : "2px solid transparent",
                cursor: "pointer", padding: 0, outline: "none",
              }}
              onClick={() => setActiveColor(c)}
            />
          ))}
        </div>

        <span style={{ width: 1, height: 24, background: "rgba(219,218,216,0.12)", margin: "0 4px" }} />

        {/* Stroke width */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {STROKE_WIDTHS.map((w) => (
            <button
              key={w}
              className="btn-flat"
              title={`${w}px`}
              style={{
                width: 32, height: 32, padding: 0, minWidth: "auto",
                display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: 4, cursor: "pointer",
                background: strokeWidth === w ? "rgba(36,86,130,0.25)" : "transparent",
                color: strokeWidth === w ? "var(--color-light)" : "var(--color-text-dim)",
              }}
              onClick={() => setStrokeWidth(w)}
            >
              <span style={{ display: "block", width: 16, height: w, background: "currentColor", borderRadius: 1 }} />
            </button>
          ))}
        </div>

        <span style={{ width: 1, height: 24, background: "rgba(219,218,216,0.12)", margin: "0 4px" }} />

        {/* Undo / Clear */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button
            className="btn-flat"
            title="Undo (Ctrl+Z)"
            style={{ width: 32, height: 32, padding: 0, minWidth: "auto", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 4, color: "var(--color-text-dim)" }}
            onClick={handleUndo}
          >
            <i className="material-icons" style={{ fontSize: 18 }}>undo</i>
          </button>
          <button
            className="btn-flat"
            title="Clear all"
            style={{ width: 32, height: 32, padding: 0, minWidth: "auto", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 4, color: "var(--color-danger)" }}
            onClick={handleClear}
          >
            <i className="material-icons" style={{ fontSize: 18 }}>delete_outline</i>
          </button>
          <button
            className="btn-flat"
            title="Export as PNG"
            style={{ width: 32, height: 32, padding: 0, minWidth: "auto", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 4, color: "var(--color-text-dim)" }}
            onClick={handleExportPng}
          >
            <i className="material-icons" style={{ fontSize: 18 }}>download</i>
          </button>
          <button
            className="btn-flat"
            title={`${showDistances ? "Hide" : "Show"} distances on every line/arrow`}
            style={{
              width: 32, height: 32, padding: 0, minWidth: "auto",
              display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: 4,
              background: showDistances ? "rgba(36,86,130,0.25)" : "transparent",
              color: showDistances ? "var(--color-light)" : "var(--color-text-dim)",
            }}
            onClick={() => setShowDistances((v) => !v)}
          >
            <i className="material-icons" style={{ fontSize: 18 }}>straighten</i>
          </button>
        </div>

        <span style={{ width: 1, height: 24, background: "rgba(219,218,216,0.12)", margin: "0 4px" }} />

        {/* Load an existing map as a starting point, instead of drawing from scratch */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input
            type="text"
            value={mapCode}
            onChange={(e) => setMapCode(e.target.value)}
            placeholder="Map code"
            maxLength={10}
            style={{
              width: 90, fontSize: 12, textTransform: "uppercase",
              padding: "5px 8px", height: 32, boxSizing: "border-box",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleLoadMap();
            }}
          />
          <button
            type="button"
            className="btn btn-small btn-secondary"
            disabled={!mapCode.trim() || loadingMap}
            onClick={handleLoadMap}
            title="Load this map's shapes as a starting point"
          >
            {loadingMap ? "Loading..." : "Load"}
          </button>
        </div>

        <span style={{ width: 1, height: 24, background: "rgba(219,218,216,0.12)", margin: "0 4px" }} />

        {/* Markers (drag onto map) */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 11, color: "var(--color-text-dim)", marginRight: 2 }}>Markers:</span>
          <StampIcon type="stamp-rect" color="#2ecc71" label="Green rectangle" />
          <StampIcon type="stamp-rect" color="#3498db" label="Blue rectangle" />
          <StampIcon type="stamp-triangle" color="#2ecc71" label="Green triangle" />
          <StampIcon type="stamp-triangle" color="#3498db" label="Blue triangle" />
        </div>

        {/* Right side: Save / Cancel */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button
            className="btn btn-secondary btn-small"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="btn btn-small"
            onClick={handleSave}
          >
            Save Plan
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div ref={canvasContainerRef} style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column" }}>
        <MapCanvas
          ref={mapCanvasRef}
          activeTool={activeTool}
          activeColor={activeColor}
          strokeWidth={strokeWidth}
          peerId="plan-editor"
          onShapeAdded={handleShapeAdded}
          onShapeUpdated={handleShapeUpdated}
          onShapeRemoved={handleShapeRemoved}
          enableStampDrop
          store={useOperationPlanStore}
          showDistances={showDistances}
        />
      </div>
    </div>
  );
}


/* ── Draggable stamp icon ────────────────────────────────────────── */
function StampIcon({ type, color, label }: { type: string; color: string; label: string }) {
  return (
    <div
      draggable
      title={label + " (drag onto map)"}
      onDragStart={(e) => {
        e.dataTransfer.setData("stamp-type", type);
        e.dataTransfer.setData("stamp-color", color);
        e.dataTransfer.effectAllowed = "copy";
      }}
      style={{
        width: 32,
        height: 32,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "grab",
        borderRadius: 4,
        border: "1px dashed rgba(219,218,216,0.2)",
        background: "rgba(255,255,255,0.03)",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
    >
      {type === "stamp-rect" ? (
        <div
          style={{
            width: 18,
            height: 12,
            background: color,
            opacity: 0.6,
            border: `2px solid ${color}`,
            borderRadius: 2,
          }}
        />
      ) : (
        <svg width="18" height="16" viewBox="0 0 18 16">
          <polygon
            points="9,1 1,15 17,15"
            fill={color}
            fillOpacity="0.4"
            stroke={color}
            strokeWidth="2"
          />
        </svg>
      )}
    </div>
  );
}
