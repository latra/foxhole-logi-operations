/* ── Real-time updates for one logistics order via WebSocket ──────── */
/*
 * Each logistics order gets its own isolated room on the backend
 * (see backend/api/ws_manager.py) — connecting here only ever receives
 * events for this exact order_id, never another one's activity.
 */

import { useEffect, useRef } from "react";
import { API_BASE_URL } from "../api/client";
import { useAuthStore } from "../stores/authStore";

export type LogisticsWSEvent = "order_changed" | "items_changed" | "vehicles_changed";

const RECONNECT_DELAY_MS = 2000;

export function useLogisticsOrderSocket(
  orderId: string | null,
  onEvent: (event: LogisticsWSEvent) => void,
) {
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!orderId) return;

    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let closedByUs = false;

    const connect = () => {
      const jwt = useAuthStore.getState().jwt;
      if (!jwt) return;

      const wsBase = API_BASE_URL.replace(/^http/, "ws");
      socket = new WebSocket(`${wsBase}/logistics/${orderId}/ws?token=${encodeURIComponent(jwt)}`);

      socket.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data?.event) onEventRef.current(data.event as LogisticsWSEvent);
        } catch {
          // ignore malformed messages
        }
      };

      socket.onclose = () => {
        if (closedByUs) return;
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      };
    };

    connect();

    return () => {
      closedByUs = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [orderId]);
}
