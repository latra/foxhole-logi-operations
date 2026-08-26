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


class OperationsWSManager:
    """Connection manager for operation list/detail live updates.

    Unlike the per-order logistics rooms, one connection here can belong to
    several rooms at once — one per group the connecting user is an ACTIVE
    member of — since a single user's operations page shows operations
    across all of their groups. A broadcast for an operation is sent to the
    rooms of every group that can see it (its creator group plus any invited
    groups), with each connected socket notified at most once even if it
    belongs to more than one of those rooms.
    """

    def __init__(self) -> None:
        self._rooms: dict[str, set[WebSocket]] = {}
        self._socket_groups: dict[WebSocket, set[str]] = {}

    async def connect(self, group_ids: list[str], websocket: WebSocket) -> None:
        await websocket.accept()
        groups = set(group_ids)
        self._socket_groups[websocket] = groups
        for gid in groups:
            self._rooms.setdefault(gid, set()).add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        for gid in self._socket_groups.pop(websocket, ()):
            room = self._rooms.get(gid)
            if not room:
                continue
            room.discard(websocket)
            if not room:
                self._rooms.pop(gid, None)

    async def broadcast_to_groups(self, group_ids: list[str], message: dict) -> None:
        targets: set[WebSocket] = set()
        for gid in group_ids:
            targets |= self._rooms.get(gid, set())
        dead: list[WebSocket] = []
        for ws in targets:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


operations_ws_manager = OperationsWSManager()
