"""JWT utilities for Discord-based authentication."""

from datetime import datetime, timedelta, timezone

import jwt

from config import settings


def create_access_token(subject: str) -> str:
    """Create a JWT with the user's UUID as subject."""
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.auth.access_token_expire_minutes
    )
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, settings.auth.secret_key, algorithm=settings.auth.algorithm)


def decode_access_token(token: str) -> str:
    """Decode a JWT and return the subject (user id)."""
    try:
        payload = jwt.decode(
            token, settings.auth.secret_key, algorithms=[settings.auth.algorithm]
        )
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise ValueError("Missing subject")
        return user_id
    except jwt.ExpiredSignatureError:
        raise ValueError("Token expired")
    except jwt.InvalidTokenError:
        raise ValueError("Invalid token")
