"""In-memory room manager for live collaborative-map WebSocket sessions.

Mirrors services/operation_plan_hub.py's shape-broadcast pattern, plus
presence tracking (who's currently connected) for the map's connected-users
menu. Single-process only — see that module's docstring for the caveat.

Persistence lives in the database (models.map_session.MapSession.shapes),
committed on every mutation by the route handler; this hub only holds the
live authoritative copy plus open connections while at least one client is
in the room.
"""

from __future__ import annotations

from typing import Any, TypedDict

from fastapi import WebSocket


class PresenceUser(TypedDict):
    id: str
    display_name: str
    avatar_url: str | None


class MapSessionHub:
    def __init__(self) -> None:
        self._rooms: dict[str, dict[WebSocket, PresenceUser]] = {}
        self._state: dict[str, list[dict]] = {}

    def get_state(self, code: str, initial: list[dict] | None) -> list[dict]:
        if code not in self._state:
            self._state[code] = list(initial or [])
        return self._state[code]

    def join(self, code: str, websocket: WebSocket, user: PresenceUser) -> None:
        self._rooms.setdefault(code, {})[websocket] = user

    def leave(self, code: str, websocket: WebSocket) -> None:
        room = self._rooms.get(code)
        if not room:
            return
        room.pop(websocket, None)
        if not room:
            self._rooms.pop(code, None)
            self._state.pop(code, None)

    def presence(self, code: str) -> list[PresenceUser]:
        """De-duplicated by user id — the same person can have multiple tabs open."""
        room = self._rooms.get(code, {})
        seen: dict[str, PresenceUser] = {}
        for user in room.values():
            seen[user["id"]] = user
        return list(seen.values())

    async def broadcast(
        self, code: str, message: dict[str, Any], *, exclude: WebSocket | None = None
    ) -> None:
        room = self._rooms.get(code)
        if not room:
            return
        for ws in list(room):
            if ws is exclude:
                continue
            try:
                await ws.send_json(message)
            except Exception:
                room.pop(ws, None)

    async def broadcast_presence(self, code: str) -> None:
        await self.broadcast(code, {"kind": "presence", "users": self.presence(code)})


map_session_hub = MapSessionHub()
