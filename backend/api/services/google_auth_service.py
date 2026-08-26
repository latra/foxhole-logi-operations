from urllib.parse import urlencode

import httpx
from fastapi import HTTPException, status
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from sqlalchemy.ext.asyncio import AsyncSession

from auth import create_access_token
from config import settings
from repositories import user_repository
from schemas import TokenResponse

_GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
_GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"


def build_authorization_url() -> str:
    params = {
        "client_id": settings.google.client_id,
        "redirect_uri": settings.google.redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account",
    }
    return f"{_GOOGLE_AUTH_URL}?{urlencode(params)}"


async def exchange_code(code: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            _GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.google.client_id,
                "client_secret": settings.google.client_secret,
                "redirect_uri": settings.google.redirect_uri,
                "grant_type": "authorization_code",
            },
        )
    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to exchange code with Google",
        )
    return resp.json()


def verify_id_token(token: str) -> dict:
    try:
        return id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            settings.google.client_id,
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google ID token",
        )


async def handle_callback(db: AsyncSession, code: str) -> TokenResponse:
    tokens = await exchange_code(code)
    claims = verify_id_token(tokens["id_token"])

    google_id: str = claims["sub"]
    email: str = claims.get("email", "")
    name: str = claims.get("name", email.split("@")[0])
    picture: str | None = claims.get("picture")

    user = await user_repository.upsert_google_user(
        db,
        google_id=google_id,
        email=email,
        name=name,
        profile_picture=picture,
    )
    await db.commit()

    return TokenResponse(access_token=create_access_token(subject=user.email))
