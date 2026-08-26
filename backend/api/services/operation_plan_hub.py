"""In-memory room manager for live operation-plan WebSocket sessions.

Single-process only: connections and cached shape state live in this module's
memory, so this does not fan out across multiple uvicorn workers. Fine for the
current single-process deployment; a multi-worker setup would need a shared
broker (e.g. Redis pub/sub) instead.
"""

from __future__ import annotations

from typing import Any

from fastapi import WebSocket


class OperationPlanHub:
    def __init__(self) -> None:
        self._rooms: dict[str, set[WebSocket]] = {}
        self._state: dict[str, list[dict]] = {}

    def get_state(self, operation_id: str, initial: list[dict] | None) -> list[dict]:
        if operation_id not in self._state:
            self._state[operation_id] = list(initial or [])
        return self._state[operation_id]

    def join(self, operation_id: str, websocket: WebSocket) -> None:
        self._rooms.setdefault(operation_id, set()).add(websocket)

    def leave(self, operation_id: str, websocket: WebSocket) -> None:
        room = self._rooms.get(operation_id)
        if not room:
            return
        room.discard(websocket)
        if not room:
            self._rooms.pop(operation_id, None)
            self._state.pop(operation_id, None)

    async def broadcast(
        self, operation_id: str, message: dict[str, Any], *, exclude: WebSocket | None = None
    ) -> None:
        room = self._rooms.get(operation_id)
        if not room:
            return
        for ws in list(room):
            if ws is exclude:
                continue
            try:
                await ws.send_json(message)
            except Exception:
                room.discard(ws)


plan_hub = OperationPlanHub()
