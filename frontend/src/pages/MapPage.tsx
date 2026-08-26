/* ── Collaborative Map page ───────────────────────────────────────── */

import { useCallback, useEffect, useRef, useState } from "react";
import Navbar from "../components/layout/Navbar";
import MapSessionModal from "../components/map/MapSessionModal";
import MapToolbar from "../components/map/MapToolbar";
import MapCanvas from "../components/map/MapCanvas";
import type { MapCanvasHandle } from "../components/map/MapCanvas";
import { useMapSession } from "../components/map/useMapSession";
import { useMapStore } from "../components/map/mapStore";
import { useAuthStore } from "../stores/authStore";
import type { ShapeType, MapShape } from "../components/map/mapTypes";
import { fetchWarPois, warPoisSignature, type WarPoi } from "../components/map/warPois";

/** How often to refresh the War API points-of-interest layer. */
const WAR_POIS_REFRESH_MS = 3 * 60 * 1000;

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
    broadcastUndo,
    broadcastClear,
    disconnect,
  } = useMapSession();

  const undoLast = useMapStore((s) => s.undoLast);
  const clearAll = useMapStore((s) => s.clearAll);

  const mapCanvasRef = useRef<MapCanvasHandle>(null);

  const [activeTool, setActiveTool] = useState<ShapeType>("line");
  const [activeColor, setActiveColor] = useState("#e74c3c");
  const [strokeWidth, setStrokeWidth] = useState(3);

  const [warPois, setWarPois] = useState<WarPoi[]>([]);
  const [showWarLayer, setShowWarLayer] = useState(true);
  const warPoisSignatureRef = useRef("");

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
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleUndo]);

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
            showWarLayer={showWarLayer}
            onToggleWarLayer={() => setShowWarLayer((v) => !v)}
            sessionCode={sessionCode}
            connectedUsers={connectedUsers}
            onDisconnect={disconnect}
          />
        )}

        {/* Canvas — always rendered (darkened behind modal) */}
        <MapCanvas
          ref={mapCanvasRef}
          activeTool={activeTool}
          activeColor={activeColor}
          strokeWidth={strokeWidth}
          peerId={selfId}
          onShapeAdded={handleShapeAdded}
          enableStampDrop
          warPois={warPois}
          showWarLayer={showWarLayer}
        />
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
