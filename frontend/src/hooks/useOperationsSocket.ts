/* ── Real-time updates for the operations list via WebSocket ─────────── */
/*
 * One connection per mount — the backend joins it into a room per group the
 * user is an active member of (see backend/api/ws_manager.py,
 * OperationsWSManager) and pushes an event whenever an operation is
 * created, changed, cancelled, or deleted for any of those groups.
 *
 * A client-driven ping/pong keeps the connection alive and lets us detect a
 * silently-dropped connection (as opposed to a clean close) so it can be
 * reconnected quickly instead of waiting on a low-level timeout.
 */

import { useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "../api/client";
import { useAuthStore } from "../stores/authStore";

export interface OperationsWSEvent {
  event: "operation_changed";
  operation_id: string;
}

export type OperationsSocketStatus = "connecting" | "connected" | "disconnected";

const RECONNECT_DELAY_MS = 2000;
const PING_INTERVAL_MS = 20000;
const PONG_TIMEOUT_MS = 10000;

export function useOperationsSocket(onEvent: (event: OperationsWSEvent) => void) {
  const [status, setStatus] = useState<OperationsSocketStatus>("connecting");

  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let pingTimer: ReturnType<typeof setInterval> | undefined;
    let pongTimeoutTimer: ReturnType<typeof setTimeout> | undefined;
    let closedByUs = false;

    const stopKeepAlive = () => {
      if (pingTimer) clearInterval(pingTimer);
      if (pongTimeoutTimer) clearTimeout(pongTimeoutTimer);
    };

    const startKeepAlive = (ws: WebSocket) => {
      pingTimer = setInterval(() => {
        if (ws.readyState !== WebSocket.OPEN) return;
        ws.send(JSON.stringify({ kind: "ping" }));
        // If no pong arrives in time, the connection is stale — force a reconnect.
        pongTimeoutTimer = setTimeout(() => ws.close(), PONG_TIMEOUT_MS);
      }, PING_INTERVAL_MS);
    };

    const connect = () => {
      const jwt = useAuthStore.getState().jwt;
      if (!jwt) return;

      setStatus((s) => (s === "connected" ? s : "connecting"));

      const wsBase = API_BASE_URL.replace(/^http/, "ws");
      socket = new WebSocket(`${wsBase}/operations/ws?token=${encodeURIComponent(jwt)}`);

      socket.onopen = () => {
        setStatus("connected");
        if (socket) startKeepAlive(socket);
      };

      socket.onmessage = (e) => {
        let data: unknown;
        try {
          data = JSON.parse(e.data);
        } catch {
          return;
        }
        const msg = data as { kind?: string; event?: string; operation_id?: string };
        if (msg.kind === "pong" && pongTimeoutTimer) {
          clearTimeout(pongTimeoutTimer);
          return;
        }
        if (msg.event === "operation_changed" && msg.operation_id) {
          onEventRef.current({ event: "operation_changed", operation_id: msg.operation_id });
        }
      };

      socket.onclose = () => {
        stopKeepAlive();
        if (closedByUs) return;
        setStatus("disconnected");
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      };
    };

    connect();

    return () => {
      closedByUs = true;
      stopKeepAlive();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, []);

  return status;
}
