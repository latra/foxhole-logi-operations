/* ── Tile-based canvas with drawing layer over the Foxhole map ──── */

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useMapStore, type ShapeStore } from "./mapStore";
import type { MapShape, ShapeType, Point } from "./mapTypes";
import { generateId } from "./mapTypes";
import { FACTION_COLORS, structureName, hexDisplayName, type WarPoi } from "./warPois";

interface Props {
  activeTool: ShapeType;
  activeColor: string;
  strokeWidth: number;
  peerId: string;
  onShapeAdded: (shape: MapShape) => void;
  enableStampDrop?: boolean;
  warPois?: WarPoi[];
  showWarLayer?: boolean;
  /** Which shape store to read/write. Defaults to the shared war-map store. */
  store?: ShapeStore;
  /** When true, drawing/dropping is disabled — pan & zoom still work. */
  readOnly?: boolean;
  /** Called when the user clicks a War POI dot (only checked when set). */
  onPoiClick?: (poi: WarPoi) => void;
  /** A POI to highlight with a ring; the camera also centers on it once, on mount. */
  selectedPoi?: WarPoi | null;
}

export interface MapCanvasHandle {
  exportPNG: () => void;
}

/* ── Tile configuration ───────────────────────────────────────────── */
const TILE_SIZE = 512;
const MAP_W = 10240;
const MAP_H = 6216;

const ZOOM_LEVELS = [
  { scale: 1 / 8, dir: "0", cols: 3, rows: 2 },
  { scale: 1 / 4, dir: "1", cols: 5, rows: 4 },
  { scale: 1 / 2, dir: "2", cols: 10, rows: 7 },
  { scale: 1, dir: "3", cols: 20, rows: 13 },
];

function pickTileLevel(zoom: number): number {
  for (let i = ZOOM_LEVELS.length - 1; i >= 0; i--) {
    if (ZOOM_LEVELS[i].scale <= zoom * 1.5) return i;
  }
  return 0;
}

/* ── Tile cache (module-level, survives re-renders) ───────────────── */
const tileCache = new Map<string, HTMLImageElement>();
const tileLoading = new Set<string>();

function loadTile(level: number, col: number, row: number, cb: () => void): HTMLImageElement | null {
  const key = `${level}/${col}_${row}`;
  const cached = tileCache.get(key);
  if (cached) return cached;
  if (tileLoading.has(key)) return null;

  tileLoading.add(key);
  const img = new Image();
  img.src = `/map-tiles/${ZOOM_LEVELS[level].dir}/${col}_${row}.webp`;
  img.onload = () => { tileCache.set(key, img); tileLoading.delete(key); cb(); };
  img.onerror = () => { tileLoading.delete(key); };
  return null;
}

/* ── Preview (low-res fallback) ───────────────────────────────────── */
let previewImg: HTMLImageElement | null = null;
const previewPromise = new Promise<void>((resolve) => {
  const img = new Image();
  img.src = "/map-tiles/map-preview.webp";
  img.onload = () => { previewImg = img; resolve(); };
  img.onerror = () => resolve();
});

/* ── Component ────────────────────────────────────────────────────── */
const MapCanvas = forwardRef<MapCanvasHandle, Props>(function MapCanvas({
  activeTool,
  activeColor,
  strokeWidth,
  peerId,
  onShapeAdded,
  enableStampDrop = false,
  warPois = [],
  showWarLayer = true,
  store: storeProp,
  readOnly = false,
  onPoiClick,
  selectedPoi = null,
}, ref) {
  const store = storeProp ?? useMapStore;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const addShape = store((s) => s.addShape);

  /* ── Camera stored in refs (no re-render on pan/zoom) ─────────── */
  const camRef = useRef({ ox: 0, oy: 0, zoom: 0.1 });
  const needsRender = useRef(true);
  const initializedRef = useRef(false);

  /* ── Drawing state ────────────────────────────────────────────── */
  const drawingRef = useRef<{
    active: boolean;
    start: Point | null;
    current: Point | null;
  }>({ active: false, start: null, current: null });

  /* ── Panning state ────────────────────────────────────────────── */
  const panRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    camStartX: number;
    camStartY: number;
  }>({ active: false, startX: 0, startY: 0, camStartX: 0, camStartY: 0 });

  /* ── Text input (needs React state for the DOM element) ───────── */
  const [textInput, setTextInput] = useState<{ pos: Point; screenPos: Point } | null>(null);
  const [textValue, setTextValue] = useState("");

  /* ── War POI hover tooltip ───────────────────────────────────── */
  const [hoveredPoi, setHoveredPoi] = useState<{ poi: WarPoi; screenPos: Point } | null>(null);
  const hoveredPoiRef = useRef<WarPoi | null>(null);

  /* ── Keep props in refs so the render loop always sees latest ──── */
  const propsRef = useRef({ activeTool, activeColor, strokeWidth, peerId, onShapeAdded, enableStampDrop, warPois, showWarLayer, store, readOnly, onPoiClick, selectedPoi });
  propsRef.current = { activeTool, activeColor, strokeWidth, peerId, onShapeAdded, enableStampDrop, warPois, showWarLayer, store, readOnly, onPoiClick, selectedPoi };

  /* ── Subscribe to store changes ───────────────────────────────── */
  useEffect(() => {
    const unsub = store.subscribe(() => { needsRender.current = true; });
    return unsub;
  }, [store]);

  /* ── Mark dirty when props change ─────────────────────────────── */
  useEffect(() => { needsRender.current = true; }, [activeTool, activeColor, strokeWidth, warPois, showWarLayer, selectedPoi]);

  /* ── Screen → map coordinate conversion ───────────────────────── */
  const screenToMap = useCallback((sx: number, sy: number): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const cam = camRef.current;
    return {
      x: ((sx - rect.left) * dpr - cam.ox) / cam.zoom,
      y: ((sy - rect.top) * dpr - cam.oy) / cam.zoom,
    };
  }, []);

  /* ── Render function (reads everything from refs) ─────────────── */
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const { ox, oy, zoom } = camRef.current;
    const { activeTool: tool, activeColor: color, strokeWidth: sw, peerId: pid } = propsRef.current;
    const shapes = propsRef.current.store.getState().shapes;
    const drawing = drawingRef.current;

    ctx.clearRect(0, 0, w, h);

    // Dark background
    ctx.fillStyle = "#111111";
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(zoom, zoom);

    // 1. Draw preview fallback
    if (previewImg) {
      ctx.drawImage(previewImg, 0, 0, MAP_W, MAP_H);
    }

    // 2. Draw visible high-res tiles
    const levelIdx = pickTileLevel(zoom);
    const level = ZOOM_LEVELS[levelIdx];
    const tileMapSize = TILE_SIZE / level.scale;

    const visMinX = -ox / zoom;
    const visMinY = -oy / zoom;
    const visMaxX = (w - ox) / zoom;
    const visMaxY = (h - oy) / zoom;

    const startCol = Math.max(0, Math.floor(visMinX / tileMapSize));
    const startRow = Math.max(0, Math.floor(visMinY / tileMapSize));
    const endCol = Math.min(level.cols - 1, Math.floor(visMaxX / tileMapSize));
    const endRow = Math.min(level.rows - 1, Math.floor(visMaxY / tileMapSize));

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const tile = loadTile(levelIdx, c, r, () => { needsRender.current = true; });
        if (tile) {
          ctx.drawImage(tile, c * tileMapSize, r * tileMapSize, tileMapSize, tileMapSize);
        }
      }
    }

    // 3. Dim overlay so drawings stand out
    ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
    ctx.fillRect(0, 0, MAP_W, MAP_H);

    // 3.5. War API points-of-interest layer (faction-colored dots)
    if (propsRef.current.showWarLayer) {
      const dotRadius = 6 / zoom;
      for (const poi of propsRef.current.warPois) {
        ctx.beginPath();
        ctx.arc(poi.x, poi.y, dotRadius, 0, Math.PI * 2);
        ctx.fillStyle = FACTION_COLORS[poi.teamId] ?? FACTION_COLORS.NONE;
        ctx.globalAlpha = 0.85;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1 / zoom;
        ctx.strokeStyle = "rgba(0,0,0,0.6)";
        ctx.stroke();
      }
    }

    // 3.6. Selected POI highlight ring (e.g. a stockpile's picked location)
    const selected = propsRef.current.selectedPoi;
    if (selected) {
      const ringRadius = 12 / zoom;
      ctx.beginPath();
      ctx.arc(selected.x, selected.y, ringRadius, 0, Math.PI * 2);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2.5 / zoom;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(selected.x, selected.y, ringRadius + 4 / zoom, 0, Math.PI * 2);
      ctx.strokeStyle = "#f1c40f";
      ctx.lineWidth = 1.5 / zoom;
      ctx.stroke();
    }

    // 4. Draw committed shapes
    for (const s of shapes) drawShape(ctx, s);

    // 5. Draw in-progress preview
    if (drawing.active && drawing.start && drawing.current && tool !== "text") {
      drawShape(ctx, {
        id: "__preview__",
        type: tool,
        p1: drawing.start,
        p2: drawing.current,
        color,
        strokeWidth: sw / zoom,
        author: pid,
      });
    }

    ctx.restore();
  }, []);

  /* ── Animation loop ───────────────────────────────────────────── */
  useEffect(() => {
    let running = true;
    const loop = () => {
      if (!running) return;
      if (needsRender.current) {
        needsRender.current = false;
        render();
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    return () => { running = false; };
  }, [render]);

  /* ── Resize & initial fit ──────────────────────────────────────── */
  const fitMap = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    if (!initializedRef.current) {
      initializedRef.current = true;
      const cw = rect.width * dpr;
      const ch = rect.height * dpr;
      const padding = 40 * dpr;
      const fitZoom = Math.min((cw - padding) / MAP_W, (ch - padding) / MAP_H);
      const z = Math.max(fitZoom, 0.02);
      camRef.current = {
        ox: (cw - MAP_W * z) / 2,
        oy: (ch - MAP_H * z) / 2,
        zoom: z,
      };
    }

    needsRender.current = true;
  }, []);

  useEffect(() => {
    // Wait for preview to load before first fit so the user sees the map immediately
    previewPromise.then(() => {
      fitMap();

      // If we're opening straight onto a selected point (e.g. viewing a
      // stockpile's picked location), center on it instead of the whole map.
      const sel = propsRef.current.selectedPoi;
      const canvas = canvasRef.current;
      if (sel && canvas) {
        const focusZoom = 0.6;
        camRef.current = {
          zoom: focusZoom,
          ox: canvas.width / 2 - sel.x * focusZoom,
          oy: canvas.height / 2 - sel.y * focusZoom,
        };
      }

      needsRender.current = true;
    });

    window.addEventListener("resize", fitMap);
    return () => window.removeEventListener("resize", fitMap);
  }, [fitMap]);

  /* ── Pointer handlers ─────────────────────────────────────────── */
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Middle or right button → pan
      if (e.button === 1 || e.button === 2) {
        e.preventDefault();
        const cam = camRef.current;
        panRef.current = {
          active: true,
          startX: e.clientX,
          startY: e.clientY,
          camStartX: cam.ox,
          camStartY: cam.oy,
        };
        canvas.setPointerCapture(e.pointerId);
        return;
      }

      if (e.button !== 0) return;
      if (propsRef.current.readOnly) return;

      const pos = screenToMap(e.clientX, e.clientY);

      if (propsRef.current.activeTool === "text") {
        const rect = canvas.getBoundingClientRect();
        setTextInput({ pos, screenPos: { x: e.clientX - rect.left, y: e.clientY - rect.top } });
        setTextValue("");
        return;
      }

      drawingRef.current = { active: true, start: pos, current: pos };
      canvas.setPointerCapture(e.pointerId);
      needsRender.current = true;
    },
    [screenToMap]
  );

  /** Find the War POI nearest the given screen point, within a fixed screen-pixel radius. */
  const hitTestPoi = useCallback(
    (clientX: number, clientY: number): WarPoi | null => {
      const { warPois, showWarLayer } = propsRef.current;
      if (!showWarLayer || warPois.length === 0) return null;

      const mapPos = screenToMap(clientX, clientY);
      const hitRadiusScreenPx = 9;
      const maxDist = hitRadiusScreenPx / camRef.current.zoom;

      let closest: WarPoi | null = null;
      let closestDist = maxDist;
      for (const poi of warPois) {
        const dx = poi.x - mapPos.x;
        const dy = poi.y - mapPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= closestDist) {
          closest = poi;
          closestDist = dist;
        }
      }
      return closest;
    },
    [screenToMap]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const pan = panRef.current;
      if (pan.active) {
        const dpr = window.devicePixelRatio || 1;
        camRef.current.ox = pan.camStartX + (e.clientX - pan.startX) * dpr;
        camRef.current.oy = pan.camStartY + (e.clientY - pan.startY) * dpr;
        needsRender.current = true;
        return;
      }

      const drawing = drawingRef.current;
      if (drawing.active) {
        drawing.current = screenToMap(e.clientX, e.clientY);
        needsRender.current = true;
        return;
      }

      const hit = hitTestPoi(e.clientX, e.clientY);
      if (hit !== hoveredPoiRef.current) {
        hoveredPoiRef.current = hit;
        const canvas = canvasRef.current;
        if (hit && canvas) {
          const rect = canvas.getBoundingClientRect();
          setHoveredPoi({ poi: hit, screenPos: { x: e.clientX - rect.left, y: e.clientY - rect.top } });
        } else {
          setHoveredPoi(null);
        }
      } else if (hit) {
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          setHoveredPoi({ poi: hit, screenPos: { x: e.clientX - rect.left, y: e.clientY - rect.top } });
        }
      }
    },
    [screenToMap, hitTestPoi]
  );

  const handlePointerLeave = useCallback(() => {
    hoveredPoiRef.current = null;
    setHoveredPoi(null);
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (panRef.current.active) {
        panRef.current.active = false;
        return;
      }

      const drawing = drawingRef.current;
      if (!drawing.active) {
        // No draw gesture in progress (e.g. a read-only picker canvas) — a plain click, check for a POI hit.
        const { onPoiClick } = propsRef.current;
        if (onPoiClick) {
          const hit = hitTestPoi(e.clientX, e.clientY);
          if (hit) onPoiClick(hit);
        }
        return;
      }
      if (!drawing.start || !drawing.current) return;

      const { activeTool: tool, activeColor: color, strokeWidth: sw, peerId: pid, onShapeAdded: onAdd } = propsRef.current;
      const cam = camRef.current;

      const dx = drawing.current.x - drawing.start.x;
      const dy = drawing.current.y - drawing.start.y;
      if (Math.sqrt(dx * dx + dy * dy) > 3 / cam.zoom) {
        const shape: MapShape = {
          id: generateId(),
          type: tool,
          p1: drawing.start,
          p2: drawing.current,
          color,
          strokeWidth: sw / cam.zoom,
          author: pid,
        };
        addShape(shape);
        onAdd(shape);
      }

      drawingRef.current = { active: false, start: null, current: null };
      needsRender.current = true;
    },
    [addShape, hitTestPoi]
  );

  /* ── Wheel zoom ───────────────────────────────────────────────── */
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * dpr;
    const my = (e.clientY - rect.top) * dpr;

    const cam = camRef.current;
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    const newZoom = Math.min(Math.max(cam.zoom * factor, 0.02), 4);

    cam.ox = mx - (mx - cam.ox) * (newZoom / cam.zoom);
    cam.oy = my - (my - cam.oy) * (newZoom / cam.zoom);
    cam.zoom = newZoom;
    needsRender.current = true;
  }, []);

  /* ── Text submit ──────────────────────────────────────────────── */
  const submitText = useCallback(() => {
    if (textInput && textValue.trim()) {
      const { activeColor: color, strokeWidth: sw, peerId: pid, onShapeAdded: onAdd } = propsRef.current;
      const cam = camRef.current;
      const shape: MapShape = {
        id: generateId(),
        type: "text",
        p1: textInput.pos,
        p2: textInput.pos,
        color,
        strokeWidth: sw / cam.zoom,
        text: textValue.trim(),
        author: pid,
      };
      addShape(shape);
      onAdd(shape);
    }
    setTextInput(null);
    setTextValue("");
  }, [textInput, textValue, addShape]);

  /* ── Keyboard ─────────────────────────────────────────────────── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && textInput) {
        setTextInput(null);
        setTextValue("");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [textInput]);

  /* ── Stamp drag-and-drop ─────────────────────────────────────── */
  useEffect(() => {
    if (!enableStampDrop) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleDragOver = (e: DragEvent) => {
      if (!propsRef.current.readOnly && e.dataTransfer?.types.includes("stamp-type")) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      if (propsRef.current.readOnly) return;
      const stampType = e.dataTransfer?.getData("stamp-type") as ShapeType | undefined;
      const stampColor = e.dataTransfer?.getData("stamp-color");
      if (!stampType || !stampColor) return;

      const pos = screenToMap(e.clientX, e.clientY);
      const shape: MapShape = {
        id: generateId(),
        type: stampType,
        p1: pos,
        p2: pos,
        color: stampColor,
        strokeWidth: 3,
        author: propsRef.current.peerId,
      };
      addShape(shape);
      propsRef.current.onShapeAdded(shape);
      needsRender.current = true;
    };

    canvas.addEventListener("dragover", handleDragOver);
    canvas.addEventListener("drop", handleDrop);
    return () => {
      canvas.removeEventListener("dragover", handleDragOver);
      canvas.removeEventListener("drop", handleDrop);
    };
  }, [enableStampDrop, addShape, screenToMap]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => e.preventDefault(), []);

  /* ── Export current view as PNG ──────────────────────────────────── */
  useImperativeHandle(ref, () => ({
    exportPNG: () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        a.href = url;
        a.download = `foxhole-map-${stamp}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, "image/png");
    },
  }), []);

  /* ── Cursor ───────────────────────────────────────────────────── */
  const cursor = panRef.current.active
    ? "grabbing"
    : hoveredPoi
    ? "pointer"
    : activeTool === "text"
    ? "text"
    : "crosshair";

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, position: "relative", overflow: "hidden", cursor }}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
        style={{ display: "block", touchAction: "none" }}
      />

      {hoveredPoi && (
        <div
          style={{
            position: "absolute",
            left: hoveredPoi.screenPos.x + 14,
            top: hoveredPoi.screenPos.y + 14,
            background: "var(--color-surface)",
            border: "1px solid rgba(219,218,216,0.12)",
            borderRadius: "var(--radius)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
            padding: "6px 10px",
            fontSize: 12,
            color: "var(--color-text)",
            whiteSpace: "nowrap",
            zIndex: 100,
            pointerEvents: "none",
          }}
        >
          <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: FACTION_COLORS[hoveredPoi.poi.teamId] ?? FACTION_COLORS.NONE,
              }}
            />
            {structureName(hoveredPoi.poi.iconType)}
          </div>
          <div style={{ color: "var(--color-text-dim)", marginTop: 2 }}>
            {hexDisplayName(hoveredPoi.poi.hex)} &middot;{" "}
            {hoveredPoi.poi.teamId === "WARDENS"
              ? "Warden"
              : hoveredPoi.poi.teamId === "COLONIALS"
              ? "Colonial"
              : "Neutral"}
          </div>
        </div>
      )}

      {textInput && (
        <input
          autoFocus
          type="text"
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitText();
            if (e.key === "Escape") { setTextInput(null); setTextValue(""); }
          }}
          onBlur={submitText}
          placeholder="Type text..."
          style={{
            position: "absolute",
            left: textInput.screenPos.x,
            top: textInput.screenPos.y,
            background: "rgba(30,30,30,0.9)",
            border: "1px solid var(--color-primary)",
            borderRadius: 3,
            color: activeColor,
            fontSize: 16,
            padding: "4px 8px",
            outline: "none",
            minWidth: 120,
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            zIndex: 50,
          }}
        />
      )}
    </div>
  );
});

export default MapCanvas;

/* ── Shape drawing helper ────────────────────────────────────────── */
function drawShape(ctx: CanvasRenderingContext2D, s: MapShape) {
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = s.strokeWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  switch (s.type) {
    case "line":
      ctx.beginPath();
      ctx.moveTo(s.p1.x, s.p1.y);
      ctx.lineTo(s.p2.x, s.p2.y);
      ctx.stroke();
      break;

    case "arrow": {
      ctx.beginPath();
      ctx.moveTo(s.p1.x, s.p1.y);
      ctx.lineTo(s.p2.x, s.p2.y);
      ctx.stroke();
      const angle = Math.atan2(s.p2.y - s.p1.y, s.p2.x - s.p1.x);
      const hl = 12 + s.strokeWidth * 2;
      ctx.beginPath();
      ctx.moveTo(s.p2.x, s.p2.y);
      ctx.lineTo(s.p2.x - hl * Math.cos(angle - Math.PI / 6), s.p2.y - hl * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(s.p2.x, s.p2.y);
      ctx.lineTo(s.p2.x - hl * Math.cos(angle + Math.PI / 6), s.p2.y - hl * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
      break;
    }
    case "rect": {
      const x = Math.min(s.p1.x, s.p2.x);
      const y = Math.min(s.p1.y, s.p2.y);
      ctx.strokeRect(x, y, Math.abs(s.p2.x - s.p1.x), Math.abs(s.p2.y - s.p1.y));
      break;
    }
    case "triangle": {
      const mx = (s.p1.x + s.p2.x) / 2;
      ctx.beginPath();
      ctx.moveTo(mx, s.p1.y);
      ctx.lineTo(s.p1.x, s.p2.y);
      ctx.lineTo(s.p2.x, s.p2.y);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case "circle": {
      const r = Math.sqrt((s.p2.x - s.p1.x) ** 2 + (s.p2.y - s.p1.y) ** 2);
      ctx.beginPath();
      ctx.arc(s.p1.x, s.p1.y, r, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case "text":
      if (s.text) {
        ctx.font = `${14 + s.strokeWidth * 2}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(s.text, s.p1.x, s.p1.y);
      }
      break;

    case "stamp-rect": {
      const sw = 50;
      const sh = 30;
      const sx = s.p1.x - sw / 2;
      const sy = s.p1.y - sh / 2;
      const prevAlpha = ctx.globalAlpha;
      ctx.globalAlpha = 0.4;
      ctx.fillRect(sx, sy, sw, sh);
      ctx.globalAlpha = prevAlpha;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(sx, sy, sw, sh);
      break;
    }

    case "stamp-triangle": {
      const side = 45;
      const th = side * Math.sqrt(3) / 2;
      const cx = s.p1.x;
      const cy = s.p1.y;
      ctx.beginPath();
      ctx.moveTo(cx, cy - th * 2 / 3);
      ctx.lineTo(cx - side / 2, cy + th / 3);
      ctx.lineTo(cx + side / 2, cy + th / 3);
      ctx.closePath();
      const prevAlpha2 = ctx.globalAlpha;
      ctx.globalAlpha = 0.4;
      ctx.fill();
      ctx.globalAlpha = prevAlpha2;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      break;
    }
  }
}
