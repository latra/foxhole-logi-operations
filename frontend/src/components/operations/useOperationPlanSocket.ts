/* ── WebSocket hook for the live, editable operation plan ─────────── */

import { useCallback, useEffect, useRef, useState } from "react";
import { getPlanSocketUrl } from "../../api/operations";
import { useOperationPlanStore } from "./planStore";
import type { MapShape } from "../map/mapTypes";

type PlanMessage =
  | { kind: "full-state"; shapes: MapShape[] }
  | { kind: "shape-add"; shape: MapShape }
  | { kind: "shape-update"; shape: MapShape }
  | { kind: "shape-remove" | "undo"; shapeId: string }
  | { kind: "clear-all" }
  | { kind: "error"; message: string };

export type PlanSocketStatus = "connecting" | "connected" | "error" | "closed";

interface UseOperationPlanSocketReturn {
  status: PlanSocketStatus;
  errorMessage: string | null;
  sendShape: (shape: MapShape) => void;
  sendShapeUpdate: (shape: MapShape) => void;
  sendShapeRemove: (shapeId: string) => void;
  sendUndo: (shapeId: string) => void;
  sendClear: () => void;
}

/** Connects for as long as the calling component is mounted. */
export function useOperationPlanSocket(operationId: string): UseOperationPlanSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<PlanSocketStatus>("connecting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { addShape, updateShape, removeShape, clearAll, loadState } = useOperationPlanStore();

  useEffect(() => {
    setStatus("connecting");
    setErrorMessage(null);
    clearAll();

    const ws = new WebSocket(getPlanSocketUrl(operationId));
    wsRef.current = ws;

    ws.onopen = () => setStatus("connected");

    ws.onmessage = (event) => {
      let msg: PlanMessage;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      switch (msg.kind) {
        case "full-state":
          loadState(msg.shapes);
          break;
        case "shape-add":
          addShape(msg.shape);
          break;
        case "shape-update":
          updateShape(msg.shape.id, msg.shape);
          break;
        case "shape-remove":
        case "undo":
          removeShape(msg.shapeId);
          break;
        case "clear-all":
          clearAll();
          break;
        case "error":
          setErrorMessage(msg.message);
          break;
      }
    };

    ws.onerror = () => setStatus("error");
    ws.onclose = () => setStatus((s) => (s === "error" ? s : "closed"));

    return () => {
      ws.close();
      wsRef.current = null;
      clearAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operationId]);

  const send = useCallback((msg: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  const sendShape = useCallback((shape: MapShape) => send({ kind: "shape-add", shape }), [send]);
  const sendShapeUpdate = useCallback((shape: MapShape) => send({ kind: "shape-update", shape }), [send]);
  const sendShapeRemove = useCallback((shapeId: string) => send({ kind: "shape-remove", shapeId }), [send]);
  const sendUndo = useCallback((shapeId: string) => send({ kind: "undo", shapeId }), [send]);
  const sendClear = useCallback(() => send({ kind: "clear-all" }), [send]);

  return { status, errorMessage, sendShape, sendShapeUpdate, sendShapeRemove, sendUndo, sendClear };
}
