/* ── Backend-socket hook for collaborative map sessions ────────────────
 *
 * Replaces the previous PeerJS-based P2P transport: the server now owns
 * session state (see backend/api/routes/map_router.py), persisting every
 * drawn shape to the database. A session survives disconnects/restarts and
 * can always be recovered later just by its code — it's not tied to
 * whichever browser tab happened to create it.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "../../api/client";
import { createMapSession } from "../../api/map";
import { useAuthStore } from "../../stores/authStore";
import { useMapStore } from "./mapStore";
import type { MapShape, MapSessionMessage, PresenceUser } from "./mapTypes";

type Status = "idle" | "connecting" | "connected" | "error";

const RECONNECT_DELAY_MS = 2000;

interface UseMapSessionReturn {
  sessionCode: string | null;
  /** Everyone currently connected to this session (includes yourself). */
  connectedUsers: PresenceUser[];
  status: Status;
  errorMessage: string | null;

  /** Create a brand new session (server-issued code) and connect to it. */
  createSession: () => void;
  /** Connect to an existing session by code. */
  joinSession: (code: string) => void;
  broadcastShape: (shape: MapShape) => void;
  broadcastShapeUpdate: (shape: MapShape) => void;
  broadcastShapeRemove: (shapeId: string) => void;
  broadcastUndo: (shapeId: string) => void;
  broadcastClear: () => void;
  /** Leave the session and reset local state. */
  disconnect: () => void;
}

export function useMapSession(): UseMapSessionReturn {
  const socketRef = useRef<WebSocket | null>(null);
  const closedByUsRef = useRef(false);
  const everConnectedRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** Holds the latest openSocket so the reconnect timer never calls a stale/self-referencing closure. */
  const openSocketRef = useRef<(code: string) => void>(() => {});

  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [connectedUsers, setConnectedUsers] = useState<PresenceUser[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { addShape, updateShape, removeShape, clearAll, loadState } = useMapStore();

  const handleMessage = useCallback(
    (msg: MapSessionMessage) => {
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
        case "presence":
          setConnectedUsers(msg.users);
          break;
      }
    },
    [addShape, updateShape, removeShape, clearAll, loadState]
  );

  const openSocket = useCallback(
    (code: string) => {
      const jwt = useAuthStore.getState().jwt;
      if (!jwt) {
        setErrorMessage("You must be signed in to use the map.");
        setStatus("error");
        return;
      }

      closedByUsRef.current = false;
      everConnectedRef.current = false;
      setStatus("connecting");
      setSessionCode(code);
      setErrorMessage(null);

      const wsBase = API_BASE_URL.replace(/^http/, "ws");
      const socket = new WebSocket(
        `${wsBase}/map/sessions/${code}/ws?token=${encodeURIComponent(jwt)}`
      );
      socketRef.current = socket;

      socket.onopen = () => {
        everConnectedRef.current = true;
        setStatus("connected");
      };

      socket.onmessage = (e) => {
        try {
          handleMessage(JSON.parse(e.data) as MapSessionMessage);
        } catch {
          // ignore malformed messages
        }
      };

      socket.onclose = () => {
        if (socketRef.current !== socket) return; // superseded by a later attempt
        socketRef.current = null;
        if (closedByUsRef.current) return;

        if (!everConnectedRef.current) {
          // Never got past the handshake — bad/unknown code, or auth failure.
          setErrorMessage("Session not found. Check the code and try again.");
          setStatus("error");
          return;
        }

        // Was connected, dropped unexpectedly — try to reconnect transparently.
        setStatus("connecting");
        reconnectTimerRef.current = setTimeout(() => openSocketRef.current(code), RECONNECT_DELAY_MS);
      };

      socket.onerror = () => {
        // onclose fires right after and handles state — nothing else to do here.
      };
    },
    [handleMessage]
  );

  useEffect(() => {
    openSocketRef.current = openSocket;
  }, [openSocket]);

  /** Create a brand new session (server-issued code) and connect to it. */
  const createSession = useCallback(() => {
    if (socketRef.current) return;
    setStatus("connecting");
    setErrorMessage(null);
    createMapSession()
      .then((session) => openSocket(session.code))
      .catch(() => {
        setErrorMessage("Could not create a session.");
        setStatus("error");
      });
  }, [openSocket]);

  /** Connect to an existing session by code. */
  const joinSession = useCallback(
    (code: string) => {
      if (socketRef.current) return;
      openSocket(code.toUpperCase().trim());
    },
    [openSocket]
  );

  const send = useCallback((msg: MapSessionMessage) => {
    socketRef.current?.send(JSON.stringify(msg));
  }, []);

  const broadcastShape = useCallback(
    (shape: MapShape) => send({ kind: "shape-add", shape }),
    [send]
  );
  const broadcastShapeUpdate = useCallback(
    (shape: MapShape) => send({ kind: "shape-update", shape }),
    [send]
  );
  const broadcastShapeRemove = useCallback(
    (shapeId: string) => send({ kind: "shape-remove", shapeId }),
    [send]
  );
  const broadcastUndo = useCallback(
    (shapeId: string) => send({ kind: "undo", shapeId }),
    [send]
  );
  const broadcastClear = useCallback(() => send({ kind: "clear-all" }), [send]);

  const disconnect = useCallback(() => {
    closedByUsRef.current = true;
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    socketRef.current?.close();
    socketRef.current = null;

    setSessionCode(null);
    setConnectedUsers([]);
    setStatus("idle");
    setErrorMessage(null);
    clearAll();
  }, [clearAll]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      closedByUsRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      socketRef.current?.close();
    };
  }, []);

  return {
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
  };
}
