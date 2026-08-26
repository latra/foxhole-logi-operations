"""Discord OAuth2 service — handles code exchange, user upsert, and JWT issue."""

from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from auth import create_access_token
from config import settings
from repositories.user_repository import user_repo
from schemas.auth import TokenResponse

_DISCORD_AUTH_URL = "https://discord.com/api/oauth2/authorize"
_DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token"
_DISCORD_USER_URL = "https://discord.com/api/users/@me"


def build_authorization_url() -> str:
    params = {
        "client_id": settings.discord.client_id,
        "redirect_uri": settings.discord.redirect_uri,
        "response_type": "code",
        "scope": "identify guilds",
    }
    return f"{_DISCORD_AUTH_URL}?{urlencode(params)}"


async def exchange_code(code: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            _DISCORD_TOKEN_URL,
            data={
                "client_id": settings.discord.client_id,
                "client_secret": settings.discord.client_secret,
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": settings.discord.redirect_uri,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to exchange code with Discord",
        )
    return resp.json()


async def fetch_discord_user(access_token: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            _DISCORD_USER_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Failed to fetch Discord user",
        )
    return resp.json()


async def handle_callback(db: AsyncSession, code: str) -> TokenResponse:
    tokens = await exchange_code(code)
    discord_access_token: str = tokens["access_token"]
    discord_refresh_token: str | None = tokens.get("refresh_token")
    expires_in: int = tokens.get("expires_in", 604800)

    user_data = await fetch_discord_user(discord_access_token)

    discord_id: str = user_data["id"]
    username: str = user_data.get("username", "")
    display_name: str = user_data.get("global_name") or username
    avatar_hash: str | None = user_data.get("avatar")
    avatar_url = (
        f"https://cdn.discordapp.com/avatars/{discord_id}/{avatar_hash}.png"
        if avatar_hash
        else None
    )

    token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

    user = await user_repo.upsert_discord_user(
        db,
        discord_id=discord_id,
        username=username,
        display_name=display_name,
        avatar_url=avatar_url,
        access_token=discord_access_token,
        refresh_token=discord_refresh_token,
        token_expires_at=token_expires_at,
    )
    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()

    jwt_token = create_access_token(subject=user.id)
    return TokenResponse(access_token=jwt_token)
