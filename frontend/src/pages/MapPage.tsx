/* ── Collaborative Map page ───────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Navbar from "../components/layout/Navbar";
import MapSessionModal from "../components/map/MapSessionModal";
import MapToolbar from "../components/map/MapToolbar";
import MapLayersPanel from "../components/map/MapLayersPanel";
import MapCanvas from "../components/map/MapCanvas";
import type { MapCanvasHandle } from "../components/map/MapCanvas";
import { useMapSession } from "../components/map/useMapSession";
import { useMapStore } from "../components/map/mapStore";
import { useAuthStore } from "../stores/authStore";
import type { ToolMode, MapShape } from "../components/map/mapTypes";
import {
  ALL_STRUCTURE_NAMES,
  fetchWarPois,
  structureName,
  STRUCTURE_NAMES_BY_CATEGORY,
  warPoisSignature,
  type StructureCategory,
  type WarPoi,
} from "../components/map/warPois";

/** How often to refresh the War API points-of-interest layer. */
const WAR_POIS_REFRESH_MS = 3 * 60 * 1000;

/** 1-7, matching the toolbar's left-to-right order (see MapToolbar.tsx). */
const TOOL_HOTKEYS: Record<string, ToolMode> = {
  "1": "select",
  "2": "line",
  "3": "arrow",
  "4": "rect",
  "5": "triangle",
  "6": "circle",
  "7": "text",
};

/** Q/W/E/R — the four drag-and-drop map markers, matching MapToolbar's order. */
const MARKER_HOTKEYS: Record<string, { tool: ToolMode; color: string }> = {
  q: { tool: "stamp-rect", color: "#2ecc71" },
  w: { tool: "stamp-rect", color: "#3498db" },
  e: { tool: "stamp-triangle", color: "#2ecc71" },
  r: { tool: "stamp-triangle", color: "#3498db" },
};

export default function MapPage() {
  const user = useAuthStore((s) => s.user);
  const selfId = user?.id ?? "local";

  const {
    sessionCode,
    connectedUsers,
    status,
    errorMessage,
    createSession,
    joinSession,
    broadcastShape,
    broadcastShapeUpdate,
    broadcastShapeRemove,
    broadcastUndo,
    broadcastClear,
    disconnect,
  } = useMapSession();

  const undoLast = useMapStore((s) => s.undoLast);
  const clearAll = useMapStore((s) => s.clearAll);

  const mapCanvasRef = useRef<MapCanvasHandle>(null);

  const [activeTool, setActiveTool] = useState<ToolMode>("line");
  const [activeColor, setActiveColor] = useState("#e74c3c");
  const [strokeWidth, setStrokeWidth] = useState(3);

  const [warPois, setWarPois] = useState<WarPoi[]>([]);
  const [showWarLayer, setShowWarLayer] = useState(true);
  const [hiddenStructureNames, setHiddenStructureNames] = useState<Set<string>>(() => new Set());
  const [showDistances, setShowDistances] = useState(false);
  const warPoisSignatureRef = useRef("");

  const toggleStructureName = useCallback((name: string) => {
    setHiddenStructureNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);
  const showAllStructures = useCallback(() => setHiddenStructureNames(new Set()), []);
  const hideAllStructures = useCallback(() => setHiddenStructureNames(new Set(ALL_STRUCTURE_NAMES)), []);

  /** Toggle every structure type in a category together — if any are currently
   *  visible, hide the whole category; if all are hidden, show it all. */
  const toggleCategory = useCallback((category: StructureCategory) => {
    const namesInCategory = STRUCTURE_NAMES_BY_CATEGORY[category];
    setHiddenStructureNames((prev) => {
      const allHidden = namesInCategory.every((n) => prev.has(n));
      const next = new Set(prev);
      if (allHidden) {
        for (const n of namesInCategory) next.delete(n);
      } else {
        for (const n of namesInCategory) next.add(n);
      }
      return next;
    });
  }, []);

  /** War POIs after the per-structure-type panel filter (each type defaults to visible). */
  const visibleWarPois = useMemo(
    () =>
      hiddenStructureNames.size === 0
        ? warPois
        : warPois.filter((p) => !hiddenStructureNames.has(structureName(p.iconType))),
    [warPois, hiddenStructureNames]
  );

  /** Load points of interest from the live Foxhole War API, refreshed periodically.
   *  Only updates state (and so only redraws the war layer) when the fetched
   *  data actually changed — the user-drawn/session layers are never touched
   *  by this effect. */
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const pois = await fetchWarPois();
      if (cancelled) return;
      const signature = warPoisSignature(pois);
      if (signature === warPoisSignatureRef.current) return;
      warPoisSignatureRef.current = signature;
      setWarPois(pois);
    };
    load();
    const interval = setInterval(load, WAR_POIS_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const isInSession = status === "connected" && sessionCode;

  /** When a shape is drawn locally, broadcast it */
  const handleShapeAdded = useCallback(
    (shape: MapShape) => {
      broadcastShape(shape);
    },
    [broadcastShape]
  );

  /** When a shape is moved/resized/rotated (select tool), broadcast the final state */
  const handleShapeUpdated = useCallback(
    (shape: MapShape) => {
      broadcastShapeUpdate(shape);
    },
    [broadcastShapeUpdate]
  );

  /** When a shape is deleted via the select tool (handle or Delete key) */
  const handleShapeRemoved = useCallback(
    (shapeId: string) => {
      broadcastShapeRemove(shapeId);
    },
    [broadcastShapeRemove]
  );

  /** Undo */
  const handleUndo = useCallback(() => {
    const removed = undoLast(selfId);
    if (removed) {
      broadcastUndo(removed.id);
    }
  }, [selfId, undoLast, broadcastUndo]);

  /** Clear all */
  const handleClear = useCallback(() => {
    clearAll();
    broadcastClear();
  }, [clearAll, broadcastClear]);

  /** Export the current map view as a PNG */
  const handleExportPng = useCallback(() => {
    mapCanvasRef.current?.exportPNG();
  }, []);

  /** Keyboard shortcuts */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        handleUndo();
        return;
      }

      if (!isInSession || e.ctrlKey || e.metaKey || e.altKey) return;

      // Don't hijack typing — the map's own text tool, the join-code field, etc.
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }

      const tool = TOOL_HOTKEYS[e.key];
      if (tool) {
        setActiveTool(tool);
        return;
      }

      const marker = MARKER_HOTKEYS[e.key.toLowerCase()];
      if (marker) {
        setActiveTool(marker.tool);
        setActiveColor(marker.color);
        return;
      }

      if (e.key.toLowerCase() === "d") {
        setShowDistances((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleUndo, isInSession]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "var(--color-bg)",
      }}
    >
      <Navbar />

      <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Session modal — shown when not in a session */}
        {!isInSession && (
          <MapSessionModal
            onCreateSession={createSession}
            onJoinSession={joinSession}
            status={status}
            errorMessage={errorMessage}
          />
        )}

        {/* Toolbar — only shown when in session */}
        {isInSession && (
          <MapToolbar
            activeTool={activeTool}
            onToolChange={setActiveTool}
            activeColor={activeColor}
            onColorChange={setActiveColor}
            strokeWidth={strokeWidth}
            onStrokeWidthChange={setStrokeWidth}
            onUndo={handleUndo}
            onClear={handleClear}
            onExportPng={handleExportPng}
            showDistances={showDistances}
            onToggleShowDistances={() => setShowDistances((v) => !v)}
            sessionCode={sessionCode}
            connectedUsers={connectedUsers}
            onDisconnect={disconnect}
          />
        )}

        {/* Canvas + right-side layers panel */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <MapCanvas
            ref={mapCanvasRef}
            activeTool={activeTool}
            activeColor={activeColor}
            strokeWidth={strokeWidth}
            peerId={selfId}
            onShapeAdded={handleShapeAdded}
            onShapeUpdated={handleShapeUpdated}
            onShapeRemoved={handleShapeRemoved}
            enableStampDrop
            warPois={visibleWarPois}
            showWarLayer={showWarLayer}
            showDistances={showDistances}
          />

          <MapLayersPanel
            showWarLayer={showWarLayer}
            onToggleWarLayer={() => setShowWarLayer((v) => !v)}
            allStructureNames={ALL_STRUCTURE_NAMES}
            hiddenStructureNames={hiddenStructureNames}
            onToggleStructureName={toggleStructureName}
            onToggleCategory={toggleCategory}
            onShowAll={showAllStructures}
            onHideAll={hideAllStructures}
          />
        </div>
      </div>

      {/* Spinner keyframes */}
      <style>{`
        @keyframes map-spin {
          to { transform: rotate(360deg); }
        }
        .map-spinner {
          display: inline-block;
          width: 14px;
          height: 14px;
          border: 2px solid rgba(219,218,216,0.2);
          border-top-color: var(--color-light);
          border-radius: 50%;
          animation: map-spin 0.6s linear infinite;
        }
      `}</style>
    </div>
  );
}
