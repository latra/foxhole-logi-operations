"""Mint a JWT for local development/testing, without going through Discord OAuth.

This is a local admin script, not an HTTP endpoint — it needs filesystem
access to the backend (to read SECRET_KEY from .env / config.yaml) and a
direct DB connection, same as the app itself. It reuses the exact same
upsert + create_access_token path as the real /auth/discord/callback flow
(see services/discord_auth_service.handle_callback), so the token it prints
is indistinguishable from one issued by a real login — it just skips
talking to Discord by upserting a fake discord_id locally.

Deliberately NOT exposed as an API route: an endpoint that mints tokens
without verifying Discord identity would let anyone impersonate any user.

Usage (from backend/api/):
    python ../create_dev_token.py
    python ../create_dev_token.py --discord-id 123 --username someone
"""

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "api"))

from auth import create_access_token  # noqa: E402
from database import AsyncSessionLocal  # noqa: E402
from repositories.user_repository import user_repo  # noqa: E402


async def mint_token(discord_id: str, username: str, display_name: str) -> str:
    async with AsyncSessionLocal() as db:
        user = await user_repo.upsert_discord_user(
            db,
            discord_id=discord_id,
            username=username,
            display_name=display_name,
        )
        await db.commit()
        return create_access_token(subject=user.id)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--discord-id", default="dev-local", help="Fake discord_id to upsert/reuse")
    parser.add_argument("--username", default="dev", help="Username for the dev user")
    parser.add_argument("--display-name", default=None, help="Display name (defaults to --username)")
    args = parser.parse_args()

    token = asyncio.run(
        mint_token(args.discord_id, args.username, args.display_name or args.username)
    )
    print(token)


if __name__ == "__main__":
    main()
