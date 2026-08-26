"""FastAPI dependencies — authentication and authorization."""

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from auth import decode_access_token
from database import get_db
from models.group import User
from repositories.user_repository import user_repo

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/discord/callback")


async def get_user_from_token(token: str, db: AsyncSession) -> User | None:
    """Resolve a User from a raw JWT string, or None if invalid/expired/unknown.

    Shared by the header-based HTTP dependency below and by WebSocket routes,
    which can't rely on OAuth2PasswordBearer reading an Authorization header.
    """
    try:
        user_id = decode_access_token(token)
    except ValueError:
        return None
    return await user_repo.get_by_id(db, user_id)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extract and validate the current user from the JWT Bearer token."""
    user = await get_user_from_token(token, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
