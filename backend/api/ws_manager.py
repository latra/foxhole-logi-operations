"""In-memory WebSocket connection manager for real-time logistics order updates.

Connections are grouped strictly by order_id ("room"). A message broadcast
for one order is only ever sent to sockets that connected to that exact
order — never to sockets watching a different order — so separate logistics
plans stay fully isolated from each other's traffic.
"""

import logging

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class LogisticsWSManager:
    def __init__(self) -> None:
        self._rooms: dict[str, set[WebSocket]] = {}

    async def connect(self, order_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._rooms.setdefault(order_id, set()).add(websocket)

    def disconnect(self, order_id: str, websocket: WebSocket) -> None:
        room = self._rooms.get(order_id)
        if not room:
            return
        room.discard(websocket)
        if not room:
            self._rooms.pop(order_id, None)

    async def broadcast(self, order_id: str, message: dict) -> None:
        """Send `message` to every socket connected to this order — and only this order."""
        room = self._rooms.get(order_id)
        if not room:
            return
        dead: list[WebSocket] = []
        for ws in room:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            room.discard(ws)


logistics_ws_manager = LogisticsWSManager()
