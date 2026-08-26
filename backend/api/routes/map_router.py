"""Collaborative map session routes — REST create/lookup + live WebSocket.

Anyone signed in may create a session or join one by code — there's no
group restriction, matching the "share a code with whoever you want" model
the map already had. State (drawn shapes) is persisted on every mutation, so
a session can be recovered later just by knowing its code, even after
everyone has disconnected and the server has restarted.
"""

import random

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy.ext.asyncio import AsyncSession

from database import AsyncSessionLocal, get_db
from dependencies import get_current_user, get_user_from_token
from models.group import User
from repositories.map_session_repository import map_session_repo
from schemas.map_session import MapSessionResponse, MapShapeIn
from services.map_session_hub import PresenceUser, map_session_hub

router = APIRouter(prefix="/map", tags=["map"])

# No 0/O/1/I — matches generateSessionCode() on the frontend.
_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
_CODE_LENGTH = 6


def _generate_code() -> str:
    return "".join(random.choice(_CODE_CHARS) for _ in range(_CODE_LENGTH))


@router.post("/sessions", response_model=MapSessionResponse, status_code=201)
async def create_session(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    for _ in range(10):
        code = _generate_code()
        if not await map_session_repo.get_by_code(db, code):
            session = await map_session_repo.create(db, code=code, shapes=[])
            await db.commit()
            return session
    raise HTTPException(
        status.HTTP_500_INTERNAL_SERVER_ERROR, "Could not generate a unique session code"
    )


@router.get("/sessions/{code}", response_model=MapSessionResponse)
async def get_session(
    code: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = await map_session_repo.get_by_code(db, code.upper().strip())
    if not session:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    return session


# ── Live session (WebSocket) ────────────────────────────────────────────

@router.websocket("/sessions/{code}/ws")
async def map_session_ws(websocket: WebSocket, code: str, token: str = Query(...)):
    code = code.upper().strip()

    async with AsyncSessionLocal() as db:
        user = await get_user_from_token(token, db)
        if not user:
            await websocket.close(code=1008)
            return

        session = await map_session_repo.get_by_code(db, code)
        if not session:
            await websocket.close(code=1008)
            return

        presence_user: PresenceUser = {
            "id": user.id,
            "display_name": user.display_name,
            "avatar_url": user.avatar_url,
        }

        await websocket.accept()
        map_session_hub.join(code, websocket, presence_user)
        try:
            shapes = map_session_hub.get_state(code, session.shapes)
            await websocket.send_json({"kind": "full-state", "shapes": shapes})
            await map_session_hub.broadcast_presence(code)

            while True:
                msg = await websocket.receive_json()
                kind = msg.get("kind")

                if kind not in ("shape-add", "shape-remove", "undo", "clear-all"):
                    continue

                if kind == "shape-add":
                    try:
                        shape = MapShapeIn(**msg["shape"]).model_dump()
                    except Exception:
                        continue
                    shapes.append(shape)
                elif kind in ("shape-remove", "undo"):
                    shape_id = msg.get("shapeId")
                    shapes[:] = [s for s in shapes if s["id"] != shape_id]
                elif kind == "clear-all":
                    shapes.clear()

                session.shapes = list(shapes)
                await db.commit()
                await map_session_hub.broadcast(code, msg, exclude=websocket)
        except WebSocketDisconnect:
            pass
        finally:
            map_session_hub.leave(code, websocket)
            await map_session_hub.broadcast_presence(code)
