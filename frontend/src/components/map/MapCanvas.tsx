/* ── Tile-based canvas with drawing layer over the Foxhole map ──── */

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useMapStore, type ShapeStore } from "./mapStore";
import type { MapShape, ShapeType, ToolMode, Point } from "./mapTypes";
import { generateId } from "./mapTypes";
import { FACTION_COLORS, structureName, structureIcon, hexDisplayName, type WarPoi } from "./warPois";
import { pixelDistanceMeters, pixelBearingDegrees } from "./hexGeometry";

interface Props {
  activeTool: ToolMode;
  activeColor: string;
  strokeWidth: number;
  peerId: string;
  onShapeAdded: (shape: MapShape) => void;
  /** Called once a move/resize/rotate gesture on an existing shape finishes (select tool only). */
  onShapeUpdated?: (shape: MapShape) => void;
  /** Called when the select tool deletes an existing shape (delete handle or Delete/Backspace key). */
  onShapeRemoved?: (shapeId: string) => void;
  enableStampDrop?: boolean;
  warPois?: WarPoi[];
  showWarLayer?: boolean;
  /** When true, every line/arrow shows its distance + bearing label, not just the selected one. */
  showDistances?: boolean;
  /** Which shape store to read/write. Defaults to the shared war-map store. */
  store?: ShapeStore;
  /** When true, drawing/dropping/editing is disabled — pan & zoom still work. */
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

/** Clamp a map-space point to the map's own bounds — nothing can be drawn off the edge. */
function clampPointToMap(p: Point): Point {
  return {
    x: Math.min(Math.max(p.x, 0), MAP_W),
    y: Math.min(Math.max(p.y, 0), MAP_H),
  };
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

/** Material Icons font used for the POI icon glyphs — must be loaded before
 *  canvas fillText() can render them (unlike the DOM, canvas text doesn't
 *  wait for webfonts on its own). */
const ICON_FONT_FAMILY = '"Material Icons"';
let iconFontReady = false;
const iconFontPromise: Promise<void> =
  typeof document !== "undefined" && "fonts" in document
    ? document.fonts.load(`24px ${ICON_FONT_FAMILY}`).then(
        () => { iconFontReady = true; },
        () => { iconFontReady = false; }
      )
    : Promise.resolve();

/* ── Component ────────────────────────────────────────────────────── */
const MapCanvas = forwardRef<MapCanvasHandle, Props>(function MapCanvas({
  activeTool,
  activeColor,
  strokeWidth,
  peerId,
  onShapeAdded,
  onShapeUpdated,
  onShapeRemoved,
  enableStampDrop = false,
  warPois = [],
  showWarLayer = true,
  showDistances = false,
  store: storeProp,
  readOnly = false,
  onPoiClick,
  selectedPoi = null,
}, ref) {
  const store = storeProp ?? useMapStore;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const addShape = store((s) => s.addShape);
  const updateShape = store((s) => s.updateShape);
  const removeShape = store((s) => s.removeShape);

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

  /* ── Selection + transform state (select tool) ─────────────────── */
  const selectedShapeIdRef = useRef<string | null>(null);
  type DragMode = "none" | "move" | "resize-p1" | "resize-p2" | "rotate";
  const dragRef = useRef<{
    mode: DragMode;
    shapeId: string | null;
    startPointer: Point;
    startP1: Point;
    startP2: Point;
  }>({ mode: "none", shapeId: null, startPointer: { x: 0, y: 0 }, startP1: { x: 0, y: 0 }, startP2: { x: 0, y: 0 } });

  /* ── Text input (needs React state for the DOM element) ───────── */
  const [textInput, setTextInput] = useState<{ pos: Point; screenPos: Point } | null>(null);
  const [textValue, setTextValue] = useState("");
  /** Guards against the classic "Enter commits, then the removed input's
   *  onBlur fires too" double-submit — see closeTextInput. */
  const textInputHandledRef = useRef(false);

  /* ── War POI hover tooltip ───────────────────────────────────── */
  const [hoveredPoi, setHoveredPoi] = useState<{ poi: WarPoi; screenPos: Point } | null>(null);
  const hoveredPoiRef = useRef<WarPoi | null>(null);

  /* ── Keep props in refs so the render loop always sees latest ──── */
  const propsRef = useRef({
    activeTool, activeColor, strokeWidth, peerId, onShapeAdded, onShapeUpdated, onShapeRemoved,
    enableStampDrop, warPois, showWarLayer, showDistances, store, readOnly, onPoiClick, selectedPoi,
  });
  propsRef.current = {
    activeTool, activeColor, strokeWidth, peerId, onShapeAdded, onShapeUpdated, onShapeRemoved,
    enableStampDrop, warPois, showWarLayer, showDistances, store, readOnly, onPoiClick, selectedPoi,
  };

  /* ── Subscribe to store changes ───────────────────────────────── */
  useEffect(() => {
    const unsub = store.subscribe(() => { needsRender.current = true; });
    return unsub;
  }, [store]);

  /* ── Mark dirty when props change ─────────────────────────────── */
  useEffect(() => { needsRender.current = true; }, [activeTool, activeColor, strokeWidth, warPois, showWarLayer, showDistances, selectedPoi]);

  /* ── Deselect when the select tool is left, or on a read-only canvas ── */
  useEffect(() => {
    if (activeTool !== "select" || readOnly) {
      selectedShapeIdRef.current = null;
      needsRender.current = true;
    }
  }, [activeTool, readOnly]);

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

  /** Keep the map from being panned/zoomed away into empty space. */
  const clampCamera = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cam = camRef.current;
    const margin = 200 * (window.devicePixelRatio || 1);
    const mapScreenW = MAP_W * cam.zoom;
    const mapScreenH = MAP_H * cam.zoom;

    const clampAxis = (pos: number, mapScreenSize: number, viewportSize: number) => {
      const a = margin;
      const b = viewportSize - mapScreenSize - margin;
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      return Math.min(Math.max(pos, lo), hi);
    };

    cam.ox = clampAxis(cam.ox, mapScreenW, canvas.width);
    cam.oy = clampAxis(cam.oy, mapScreenH, canvas.height);
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

    // 4. Draw committed shapes
    for (const s of shapes) drawShape(ctx, s);

    // 4.5. "Show distances" — every line/arrow gets its label, not just the
    // selected one (which already draws its own further below, so skip it here).
    if (propsRef.current.showDistances) {
      const selId = selectedShapeIdRef.current;
      for (const s of shapes) {
        if ((s.type !== "line" && s.type !== "arrow") || s.id === selId) continue;
        const c = shapeCenter(s);
        const ap1 = s.rotation ? rotatePoint(s.p1, c, s.rotation) : s.p1;
        const ap2 = s.rotation ? rotatePoint(s.p2, c, s.rotation) : s.p2;
        drawMeasurementLabel(ctx, ap1, ap2, zoom);
      }
    }

    // 5. Draw in-progress preview
    if (drawing.active && drawing.start && drawing.current && tool !== "text" && tool !== "select") {
      drawShape(ctx, {
        id: "__preview__",
        type: tool,
        p1: drawing.start,
        p2: drawing.current,
        color,
        strokeWidth: sw / zoom,
        author: pid,
      });

      if (tool === "line" || tool === "arrow") {
        drawMeasurementLabel(ctx, drawing.start, drawing.current, zoom);
      }
    }

    // 6. War API points-of-interest layer — drawn ABOVE user shapes so it's
    // always visible even after something's been painted over it. Each POI
    // gets a small structure-type icon (Material Icons) tinted by faction,
    // on a dark backing so it stays legible over any terrain color.
    if (propsRef.current.showWarLayer) {
      const badgeRadius = 9 / zoom;
      const iconSizePx = 12; // screen px — constant regardless of zoom
      for (const poi of propsRef.current.warPois) {
        const color = FACTION_COLORS[poi.teamId] ?? FACTION_COLORS.NONE;

        ctx.beginPath();
        ctx.arc(poi.x, poi.y, badgeRadius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(17,17,17,0.75)";
        ctx.fill();
        ctx.lineWidth = 1 / zoom;
        ctx.strokeStyle = "rgba(0,0,0,0.6)";
        ctx.stroke();

        if (iconFontReady) {
          ctx.font = `${iconSizePx / zoom}px ${ICON_FONT_FAMILY}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = color;
          ctx.fillText(structureIcon(poi.iconType), poi.x, poi.y);
        } else {
          // Font not loaded yet — fall back to a plain colored dot.
          ctx.beginPath();
          ctx.arc(poi.x, poi.y, 4 / zoom, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        }
      }
    }

    // 7. Selected POI highlight ring (e.g. a stockpile's picked location)
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

    // 8. Selection UI (bbox + handles) for the select tool
    const selectedShape = selectedShapeIdRef.current
      ? shapes.find((s) => s.id === selectedShapeIdRef.current)
      : undefined;
    if (selectedShape) drawSelectionOverlay(ctx, selectedShape, zoom);

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
    } else {
      clampCamera();
    }

    needsRender.current = true;
  }, [clampCamera]);

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

    // POI icon glyphs need the webfont loaded — re-render once it's ready
    // (independent of the map preview, may resolve at a different time).
    iconFontPromise.then(() => { needsRender.current = true; });

    // ResizeObserver (not just window resize) so the canvas also reflows when
    // its container changes size for other reasons — e.g. the right-side
    // layers panel expanding/collapsing.
    const container = containerRef.current;
    let observer: ResizeObserver | undefined;
    if (container && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => fitMap());
      observer.observe(container);
    } else {
      window.addEventListener("resize", fitMap);
    }

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", fitMap);
    };
  }, [fitMap]);

  /* ── Text input open/close (guarded against double-commit) ─────── */
  const openTextInput = useCallback((pos: Point, screenPos: Point) => {
    textInputHandledRef.current = false;
    setTextInput({ pos, screenPos });
    setTextValue("");
  }, []);

  /** Enter, Escape, and blur can all reach this — only the first one "wins". */
  const closeTextInput = useCallback(
    (commit: boolean) => {
      if (textInputHandledRef.current) return;
      textInputHandledRef.current = true;

      setTextInput((current) => {
        if (commit && current && textValue.trim()) {
          const { activeColor: color, strokeWidth: sw, peerId: pid, onShapeAdded: onAdd } = propsRef.current;
          const cam = camRef.current;
          const shape: MapShape = {
            id: generateId(),
            type: "text",
            p1: current.pos,
            p2: current.pos,
            color,
            strokeWidth: sw / cam.zoom,
            text: textValue.trim(),
            author: pid,
          };
          addShape(shape);
          onAdd(shape);
        }
        return null;
      });
      setTextValue("");
    },
    [textValue, addShape]
  );

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

      const pos = clampPointToMap(screenToMap(e.clientX, e.clientY));

      if (propsRef.current.activeTool === "select") {
        const zoom = camRef.current.zoom;
        const shapes = propsRef.current.store.getState().shapes;
        const selId = selectedShapeIdRef.current;
        const selectedShape = selId ? shapes.find((s) => s.id === selId) : undefined;

        if (selectedShape) {
          const handleHit = hitTestHandle(selectedShape, pos, zoom);
          if (handleHit === "delete") {
            const removedId = selectedShape.id;
            selectedShapeIdRef.current = null;
            removeShape(removedId);
            propsRef.current.onShapeRemoved?.(removedId);
            needsRender.current = true;
            return;
          }
          if (handleHit) {
            dragRef.current = {
              mode: handleHit === "rotate" ? "rotate" : handleHit === "p1" ? "resize-p1" : "resize-p2",
              shapeId: selectedShape.id,
              startPointer: pos,
              startP1: selectedShape.p1,
              startP2: selectedShape.p2,
            };
            canvas.setPointerCapture(e.pointerId);
            return;
          }
          if (hitTestShapeBody(selectedShape, pos)) {
            dragRef.current = {
              mode: "move",
              shapeId: selectedShape.id,
              startPointer: pos,
              startP1: selectedShape.p1,
              startP2: selectedShape.p2,
            };
            canvas.setPointerCapture(e.pointerId);
            return;
          }
        }

        // (Re)select the topmost shape under the cursor, if any.
        let hit: MapShape | undefined;
        for (let i = shapes.length - 1; i >= 0; i--) {
          if (hitTestShapeBody(shapes[i], pos)) { hit = shapes[i]; break; }
        }
        selectedShapeIdRef.current = hit ? hit.id : null;
        if (hit) {
          dragRef.current = { mode: "move", shapeId: hit.id, startPointer: pos, startP1: hit.p1, startP2: hit.p2 };
          canvas.setPointerCapture(e.pointerId);
        }
        needsRender.current = true;
        return;
      }

      if (propsRef.current.activeTool === "text") {
        const rect = canvas.getBoundingClientRect();
        openTextInput(pos, { x: e.clientX - rect.left, y: e.clientY - rect.top });
        return;
      }

      // Markers are placed with a single click (matching the drag-and-drop stamp behavior)
      if (propsRef.current.activeTool === "stamp-rect" || propsRef.current.activeTool === "stamp-triangle") {
        const { activeTool: type, activeColor: color, peerId: pid, onShapeAdded: onAdd } = propsRef.current;
        const shape: MapShape = {
          id: generateId(),
          type,
          p1: pos,
          p2: pos,
          color,
          strokeWidth: 3,
          author: pid,
        };
        addShape(shape);
        onAdd(shape);
        needsRender.current = true;
        return;
      }

      drawingRef.current = { active: true, start: pos, current: pos };
      canvas.setPointerCapture(e.pointerId);
      needsRender.current = true;
    },
    [screenToMap, openTextInput, removeShape, addShape]
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
        clampCamera();
        needsRender.current = true;
        return;
      }

      const drag = dragRef.current;
      if (drag.mode !== "none" && drag.shapeId) {
        const pos = clampPointToMap(screenToMap(e.clientX, e.clientY));
        const dx = pos.x - drag.startPointer.x;
        const dy = pos.y - drag.startPointer.y;

        if (drag.mode === "move") {
          updateShape(drag.shapeId, {
            p1: { x: drag.startP1.x + dx, y: drag.startP1.y + dy },
            p2: { x: drag.startP2.x + dx, y: drag.startP2.y + dy },
          });
        } else if (drag.mode === "resize-p1") {
          updateShape(drag.shapeId, { p1: pos });
        } else if (drag.mode === "resize-p2") {
          updateShape(drag.shapeId, { p2: pos });
        } else if (drag.mode === "rotate") {
          const shapes = propsRef.current.store.getState().shapes;
          const shape = shapes.find((s) => s.id === drag.shapeId);
          if (shape) {
            const center = shapeCenter(shape);
            const rotation = Math.atan2(pos.y - center.y, pos.x - center.x) + Math.PI / 2;
            updateShape(drag.shapeId, { rotation });
          }
        }
        needsRender.current = true;
        return;
      }

      const drawing = drawingRef.current;
      if (drawing.active) {
        drawing.current = clampPointToMap(screenToMap(e.clientX, e.clientY));
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
    [screenToMap, hitTestPoi, updateShape, clampCamera]
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

      const drag = dragRef.current;
      if (drag.mode !== "none" && drag.shapeId) {
        const shapeId = drag.shapeId;
        dragRef.current = { mode: "none", shapeId: null, startPointer: { x: 0, y: 0 }, startP1: { x: 0, y: 0 }, startP2: { x: 0, y: 0 } };
        const shape = propsRef.current.store.getState().shapes.find((s) => s.id === shapeId);
        if (shape) propsRef.current.onShapeUpdated?.(shape);
        needsRender.current = true;
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
      if (
        Math.sqrt(dx * dx + dy * dy) > 3 / cam.zoom &&
        tool !== "select" &&
        tool !== "text"
      ) {
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
    clampCamera();
    needsRender.current = true;
  }, [clampCamera]);

  /* ── Keyboard ─────────────────────────────────────────────────── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && textInput) {
        closeTextInput(false);
        return;
      }
      if (textInput) return; // don't let Delete/Backspace while typing text reach shape deletion

      if ((e.key === "Delete" || e.key === "Backspace") && selectedShapeIdRef.current) {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
        e.preventDefault();
        const id = selectedShapeIdRef.current;
        selectedShapeIdRef.current = null;
        removeShape(id);
        propsRef.current.onShapeRemoved?.(id);
        needsRender.current = true;
      } else if (e.key === "Escape" && selectedShapeIdRef.current) {
        selectedShapeIdRef.current = null;
        needsRender.current = true;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [textInput, closeTextInput, removeShape]);

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

      const pos = clampPointToMap(screenToMap(e.clientX, e.clientY));
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
    : activeTool === "select"
    ? "default"
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
            if (e.key === "Enter") closeTextInput(true);
            if (e.key === "Escape") closeTextInput(false);
          }}
          onBlur={() => closeTextInput(true)}
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

/* ── Shape geometry helpers (bounding box, center, rotation) ──────── */

interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function shapeBBox(s: MapShape): BBox {
  switch (s.type) {
    case "circle": {
      const r = Math.hypot(s.p2.x - s.p1.x, s.p2.y - s.p1.y);
      return { minX: s.p1.x - r, minY: s.p1.y - r, maxX: s.p1.x + r, maxY: s.p1.y + r };
    }
    case "text": {
      const fontSize = 14 + s.strokeWidth * 2;
      const w = Math.max(24, (s.text?.length ?? 0) * fontSize * 0.55);
      const h = fontSize * 1.3;
      return { minX: s.p1.x, minY: s.p1.y, maxX: s.p1.x + w, maxY: s.p1.y + h };
    }
    case "stamp-rect": {
      const sw = 50, sh = 30;
      return { minX: s.p1.x - sw / 2, minY: s.p1.y - sh / 2, maxX: s.p1.x + sw / 2, maxY: s.p1.y + sh / 2 };
    }
    case "stamp-triangle": {
      const side = 45;
      const th = (side * Math.sqrt(3)) / 2;
      return { minX: s.p1.x - side / 2, minY: s.p1.y - (th * 2) / 3, maxX: s.p1.x + side / 2, maxY: s.p1.y + th / 3 };
    }
    default: {
      // line, arrow, rect, triangle
      const pad = Math.max(s.strokeWidth / 2, 4);
      return {
        minX: Math.min(s.p1.x, s.p2.x) - pad,
        minY: Math.min(s.p1.y, s.p2.y) - pad,
        maxX: Math.max(s.p1.x, s.p2.x) + pad,
        maxY: Math.max(s.p1.y, s.p2.y) + pad,
      };
    }
  }
}

function shapeCenter(s: MapShape): Point {
  const b = shapeBBox(s);
  return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
}

function rotatePoint(p: Point, center: Point, angle: number): Point {
  if (!angle) return p;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos };
}

/** Draws an upright "<distance>m · <bearing>°" pill offset to one side of a segment's midpoint. */
function drawMeasurementLabel(ctx: CanvasRenderingContext2D, p1: Point, p2: Point, zoom: number) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  if (dx === 0 && dy === 0) return;

  const distanceM = pixelDistanceMeters(dx, dy);
  const bearingDeg = pixelBearingDegrees(dx, dy);
  const text = `${Math.round(distanceM)} m · ${Math.round(bearingDeg).toString().padStart(3, "0")}°`;

  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;
  const len = Math.hypot(dx, dy) || 1;
  const offset = 16 / zoom;
  const labelX = midX + (-dy / len) * offset;
  const labelY = midY + (dx / len) * offset;

  const fontSize = 12 / zoom;
  ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const padX = 6 / zoom;
  const padY = 3 / zoom;
  const w = ctx.measureText(text).width + padX * 2;
  const h = fontSize + padY * 2;

  ctx.fillStyle = "rgba(0,0,0,0.72)";
  ctx.fillRect(labelX - w / 2, labelY - h / 2, w, h);
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 1 / zoom;
  ctx.strokeRect(labelX - w / 2, labelY - h / 2, w, h);

  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, labelX, labelY);
}

function pointInBBox(p: Point, b: BBox): boolean {
  return p.x >= b.minX && p.x <= b.maxX && p.y >= b.minY && p.y <= b.maxY;
}

/** Hit-test a shape's body (bounding box, rotation-aware) for selection/move. */
function hitTestShapeBody(s: MapShape, p: Point): boolean {
  const center = shapeCenter(s);
  const localP = s.rotation ? rotatePoint(p, center, -s.rotation) : p;
  return pointInBBox(localP, shapeBBox(s));
}

type HandleKind = "p1" | "p2" | "rotate" | "delete";

const HAS_ENDPOINT_HANDLES = new Set<ShapeType>(["line", "arrow", "rect", "triangle"]);

/** Handle positions in the shape's own (unrotated) local space. */
function getLocalHandles(s: MapShape, zoom: number): Partial<Record<HandleKind, Point>> {
  const b = shapeBBox(s);
  const center = shapeCenter(s);
  const handles: Partial<Record<HandleKind, Point>> = {};

  if (HAS_ENDPOINT_HANDLES.has(s.type)) {
    handles.p1 = s.p1;
    handles.p2 = s.p2;
  } else if (s.type === "circle") {
    handles.p2 = s.p2;
  }

  handles.rotate = { x: center.x, y: b.minY - 28 / zoom };
  handles.delete = { x: b.maxX + 10 / zoom, y: b.minY - 10 / zoom };
  return handles;
}

/** Hit-test the selected shape's handles (rotation-aware) — returns which one, if any. */
function hitTestHandle(s: MapShape, p: Point, zoom: number): HandleKind | null {
  const center = shapeCenter(s);
  const localHandles = getLocalHandles(s, zoom);
  const hitR = 10 / zoom;

  for (const kind of ["delete", "rotate", "p1", "p2"] as HandleKind[]) {
    const local = localHandles[kind];
    if (!local) continue;
    const actual = s.rotation ? rotatePoint(local, center, s.rotation) : local;
    if (Math.hypot(p.x - actual.x, p.y - actual.y) <= hitR) return kind;
  }
  return null;
}

/** Draws the selection bounding box + move/resize/rotate/delete handles for a shape. */
function drawSelectionOverlay(ctx: CanvasRenderingContext2D, s: MapShape, zoom: number) {
  const b = shapeBBox(s);
  const center = shapeCenter(s);
  const localHandles = getLocalHandles(s, zoom);

  // Length + bearing label for straight shapes — drawn upright (unrotated),
  // using the shape's actual on-map endpoints (rotation applied).
  if (s.type === "line" || s.type === "arrow") {
    const actualP1 = s.rotation ? rotatePoint(s.p1, center, s.rotation) : s.p1;
    const actualP2 = s.rotation ? rotatePoint(s.p2, center, s.rotation) : s.p2;
    drawMeasurementLabel(ctx, actualP1, actualP2, zoom);
  }

  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(s.rotation || 0);
  ctx.translate(-center.x, -center.y);

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.5 / zoom;
  ctx.setLineDash([6 / zoom, 4 / zoom]);
  ctx.strokeRect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);
  ctx.setLineDash([]);

  const drawDot = (p: Point, fill: string, r = 5) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, r / zoom, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1 / zoom;
    ctx.stroke();
  };

  if (localHandles.p1) drawDot(localHandles.p1, "#3498db");
  if (localHandles.p2) drawDot(localHandles.p2, "#3498db");

  if (localHandles.rotate) {
    ctx.beginPath();
    ctx.moveTo(center.x, b.minY);
    ctx.lineTo(localHandles.rotate.x, localHandles.rotate.y);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1 / zoom;
    ctx.stroke();
    drawDot(localHandles.rotate, "#2ecc71");
  }

  if (localHandles.delete) {
    const p = localHandles.delete;
    drawDot(p, "#c0392b", 7);
    const s2 = 3 / zoom;
    ctx.beginPath();
    ctx.moveTo(p.x - s2, p.y - s2);
    ctx.lineTo(p.x + s2, p.y + s2);
    ctx.moveTo(p.x + s2, p.y - s2);
    ctx.lineTo(p.x - s2, p.y + s2);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.3 / zoom;
    ctx.stroke();
  }

  ctx.restore();
}

/* ── Shape drawing helper ────────────────────────────────────────── */
function drawShape(ctx: CanvasRenderingContext2D, s: MapShape) {
  const rotation = s.rotation || 0;
  if (rotation) {
    const center = shapeCenter(s);
    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate(rotation);
    ctx.translate(-center.x, -center.y);
  }

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
      const sw = 20;
      const sh = 15;
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
      const side = 15;
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

  if (rotation) ctx.restore();
}
