"""Authentication routes — Discord OAuth2."""

from urllib.parse import urlencode

from fastapi import APIRouter, Depends
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from dependencies import get_current_user
from schemas.auth import TokenResponse
from schemas.user import UserResponse
from services import discord_auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/discord/login", summary="Redirect to Discord OAuth consent screen")
async def discord_login():
    url = discord_auth_service.build_authorization_url()
    return RedirectResponse(url)


@router.get("/discord/callback", summary="Discord OAuth callback → redirect to frontend")
async def discord_callback(
    code: str | None = None,
    error: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    if error or not code:
        query = urlencode({"error": error or "access_denied"})
        return RedirectResponse(f"{settings.frontend.url}/login?{query}")

    try:
        token_response = await discord_auth_service.handle_callback(db, code)
    except Exception:
        query = urlencode({"error": "discord_auth_failed"})
        return RedirectResponse(f"{settings.frontend.url}/login?{query}")

    query = urlencode({"token": token_response.access_token})
    return RedirectResponse(f"{settings.frontend.url}/login?{query}")


@router.get("/me", response_model=UserResponse)
async def me(current_user=Depends(get_current_user)):
    return current_user
