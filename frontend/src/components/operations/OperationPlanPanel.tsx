/* ── Live, collaborative operation plan viewer/editor ─────────────── */

import { useCallback, useRef, useState } from "react";
import MapCanvas from "../map/MapCanvas";
import type { MapCanvasHandle } from "../map/MapCanvas";
import type { MapShape, ToolMode } from "../map/mapTypes";
import { generateId } from "../map/mapTypes";
import { useOperationPlanStore } from "./planStore";
import { useOperationPlanSocket } from "./useOperationPlanSocket";
import { TOOLS, COLORS, STROKE_WIDTHS } from "./PlanMapEditor";
import { getMapSession } from "../../api/map";
import { toastSuccess, toastError } from "../common/Toast";

interface Props {
  operationId: string;
  /** Officer/Owner of an invited group — may draw. Everyone else is view-only. */
  canEdit: boolean;
  /** Current user id, used to scope "undo" to this user's own last shape. */
  peerId: string;
}

export default function OperationPlanPanel({ operationId, canEdit, peerId }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-content">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: "var(--color-text-dim)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Operation Plan
          </span>
          <button
            className="btn-flat"
            style={{
              padding: "0 8px",
              height: 24,
              lineHeight: "24px",
              fontSize: 11,
              color: "var(--color-text-dim)",
              minWidth: "auto",
            }}
            onClick={() => setExpanded((e) => !e)}
          >
            <i className="material-icons" style={{ fontSize: 16, verticalAlign: "middle" }}>
              {expanded ? "zoom_out" : "zoom_in"}
            </i>{" "}
            {expanded ? "Collapse" : "Open Plan"}
          </button>
        </div>

        {expanded && (
          <LivePlanEditor operationId={operationId} canEdit={canEdit} peerId={peerId} />
        )}
      </div>
    </div>
  );
}

/* Only mounted while expanded — this is what owns the socket lifetime. */
function LivePlanEditor({ operationId, canEdit, peerId }: Props) {
  const [activeTool, setActiveTool] = useState<ToolMode>("arrow");
  const [activeColor, setActiveColor] = useState(COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [showDistances, setShowDistances] = useState(false);
  const [mapCode, setMapCode] = useState("");
  const [loadingMap, setLoadingMap] = useState(false);
  const mapCanvasRef = useRef<MapCanvasHandle>(null);

  const { status, errorMessage, sendShape, sendShapeUpdate, sendShapeRemove, sendUndo, sendClear } =
    useOperationPlanSocket(operationId);

  const handleShapeAdded = useCallback(
    (shape: MapShape) => sendShape(shape),
    [sendShape]
  );

  const handleShapeUpdated = useCallback(
    (shape: MapShape) => sendShapeUpdate(shape),
    [sendShapeUpdate]
  );

  const handleShapeRemoved = useCallback(
    (shapeId: string) => sendShapeRemove(shapeId),
    [sendShapeRemove]
  );

  const handleUndo = useCallback(() => {
    const removed = useOperationPlanStore.getState().undoLast(peerId);
    if (removed) sendUndo(removed.id);
  }, [peerId, sendUndo]);

  const handleClear = useCallback(() => {
    useOperationPlanStore.getState().clearAll();
    sendClear();
  }, [sendClear]);

  const handleExportPng = useCallback(() => {
    mapCanvasRef.current?.exportPNG();
  }, []);

  /** Import another map's shapes into this (already live) plan — appended
   *  alongside whatever's already here, broadcast to everyone connected,
   *  rather than replacing what the group has already drawn. */
  const handleLoadMap = useCallback(async () => {
    const code = mapCode.trim();
    if (!code) return;
    setLoadingMap(true);
    try {
      const session = await getMapSession(code.toUpperCase());
      const shapes = (session.shapes ?? []).map((s) => ({ ...s, id: generateId(), author: peerId }));
      for (const shape of shapes) {
        useOperationPlanStore.getState().addShape(shape);
        sendShape(shape);
      }
      toastSuccess(`Imported ${shapes.length} shape${shapes.length === 1 ? "" : "s"} from map ${code.toUpperCase()}`);
      setMapCode("");
    } catch {
      toastError("Map not found. Check the code and try again.");
    } finally {
      setLoadingMap(false);
    }
  }, [mapCode, peerId, sendShape]);

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background:
              status === "connected"
                ? "var(--color-success, #3a7d44)"
                : status === "connecting"
                  ? "var(--color-warning, #c49b2a)"
                  : "var(--color-danger, #b33a3a)",
          }}
        />
        <span style={{ fontSize: 11, color: "var(--color-text-dim)" }}>
          {status === "connected" ? "Live" : status === "connecting" ? "Connecting…" : "Disconnected"}
        </span>
        {!canEdit && (
          <span style={{ fontSize: 11, color: "var(--color-text-dim)" }}>· view only</span>
        )}
        {errorMessage && (
          <span style={{ fontSize: 11, color: "var(--color-danger)" }}>{errorMessage}</span>
        )}
      </div>

      {canEdit && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 8px",
            marginBottom: 8,
            background: "rgba(255,255,255,0.03)",
            borderRadius: 4,
            flexWrap: "wrap",
          }}
        >
          <button
            className="btn-flat"
            title="Select (move, resize, rotate, delete a shape)"
            style={{
              width: 30, height: 30, padding: 0, minWidth: "auto",
              display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: 4,
              background: activeTool === "select" ? "rgba(36,86,130,0.25)" : "transparent",
              color: activeTool === "select" ? "var(--color-light)" : "var(--color-text-dim)",
            }}
            onClick={() => setActiveTool("select")}
          >
            <i className="material-icons" style={{ fontSize: 16 }}>touch_app</i>
          </button>

          <span style={{ width: 1, height: 20, background: "rgba(219,218,216,0.12)" }} />

          {TOOLS.map((t) => (
            <button
              key={t.type}
              className="btn-flat"
              title={t.label}
              style={{
                width: 30, height: 30, padding: 0, minWidth: "auto",
                display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: 4,
                background: activeTool === t.type ? "rgba(36,86,130,0.25)" : "transparent",
                color: activeTool === t.type ? "var(--color-light)" : "var(--color-text-dim)",
              }}
              onClick={() => setActiveTool(t.type)}
            >
              <i className="material-icons" style={{ fontSize: 16 }}>{t.icon}</i>
            </button>
          ))}

          <span style={{ width: 1, height: 20, background: "rgba(219,218,216,0.12)" }} />

          {COLORS.map((c) => (
            <button
              key={c}
              style={{
                width: 18, height: 18, borderRadius: "50%", background: c,
                border: activeColor === c ? "2px solid var(--color-light)" : "2px solid transparent",
                padding: 0,
              }}
              onClick={() => setActiveColor(c)}
            />
          ))}

          <span style={{ width: 1, height: 20, background: "rgba(219,218,216,0.12)" }} />

          {STROKE_WIDTHS.map((w) => (
            <button
              key={w}
              className="btn-flat"
              title={`${w}px`}
              style={{
                width: 30, height: 30, padding: 0, minWidth: "auto",
                display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: 4,
                background: strokeWidth === w ? "rgba(36,86,130,0.25)" : "transparent",
                color: strokeWidth === w ? "var(--color-light)" : "var(--color-text-dim)",
              }}
              onClick={() => setStrokeWidth(w)}
            >
              <span style={{ display: "block", width: 14, height: w, background: "currentColor", borderRadius: 1 }} />
            </button>
          ))}

          <span style={{ width: 1, height: 20, background: "rgba(219,218,216,0.12)" }} />

          <button
            className="btn-flat"
            title="Undo your last shape"
            style={{ width: 30, height: 30, padding: 0, minWidth: "auto", color: "var(--color-text-dim)" }}
            onClick={handleUndo}
          >
            <i className="material-icons" style={{ fontSize: 16 }}>undo</i>
          </button>
          <button
            className="btn-flat"
            title="Clear the whole plan"
            style={{ width: 30, height: 30, padding: 0, minWidth: "auto", color: "var(--color-danger)" }}
            onClick={handleClear}
          >
            <i className="material-icons" style={{ fontSize: 16 }}>delete_outline</i>
          </button>
          <button
            className="btn-flat"
            title="Export as PNG"
            style={{ width: 30, height: 30, padding: 0, minWidth: "auto", color: "var(--color-text-dim)" }}
            onClick={handleExportPng}
          >
            <i className="material-icons" style={{ fontSize: 16 }}>download</i>
          </button>
          <button
            className="btn-flat"
            title={`${showDistances ? "Hide" : "Show"} distances on every line/arrow`}
            style={{
              width: 30, height: 30, padding: 0, minWidth: "auto",
              display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: 4,
              background: showDistances ? "rgba(36,86,130,0.25)" : "transparent",
              color: showDistances ? "var(--color-light)" : "var(--color-text-dim)",
            }}
            onClick={() => setShowDistances((v) => !v)}
          >
            <i className="material-icons" style={{ fontSize: 16 }}>straighten</i>
          </button>

          <span style={{ width: 1, height: 20, background: "rgba(219,218,216,0.12)" }} />

          <input
            type="text"
            value={mapCode}
            onChange={(e) => setMapCode(e.target.value)}
            placeholder="Map code"
            maxLength={10}
            style={{
              width: 80, fontSize: 12, textTransform: "uppercase",
              padding: "4px 6px", height: 26, boxSizing: "border-box",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleLoadMap();
            }}
          />
          <button
            type="button"
            className="btn-flat"
            title="Import that map's shapes into this plan"
            disabled={!mapCode.trim() || loadingMap}
            onClick={handleLoadMap}
            style={{ height: 26, fontSize: 11, color: "var(--color-text-dim)" }}
          >
            {loadingMap ? "..." : "Import"}
          </button>
        </div>
      )}

      <div
        style={{
          height: 420,
          display: "flex",
          flexDirection: "column",
          borderRadius: 4,
          overflow: "hidden",
          border: "1px solid rgba(219,218,216,0.12)",
        }}
      >
        <MapCanvas
          ref={mapCanvasRef}
          activeTool={activeTool}
          activeColor={activeColor}
          strokeWidth={strokeWidth}
          peerId={peerId}
          onShapeAdded={handleShapeAdded}
          onShapeUpdated={handleShapeUpdated}
          onShapeRemoved={handleShapeRemoved}
          store={useOperationPlanStore}
          readOnly={!canEdit}
          showDistances={showDistances}
        />
      </div>
    </div>
  );
}
