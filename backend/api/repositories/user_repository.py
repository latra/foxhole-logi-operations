from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import User


async def get_by_email(db: AsyncSession, email: str) -> User | None:
    return await db.scalar(select(User).where(User.email == email))


async def get_by_google_id(db: AsyncSession, google_id: str) -> User | None:
    return await db.scalar(select(User).where(User.google_id == google_id))


async def create(
    db: AsyncSession,
    *,
    name: str,
    email: str,
    hashed_password: str | None = None,
    profile_picture: str | None = None,
    google_id: str | None = None,
) -> User:
    user = User(
        name=name,
        email=email,
        hashed_password=hashed_password,
        profile_picture=profile_picture,
        google_id=google_id,
    )
    db.add(user)
    await db.flush()
    return user


async def upsert_google_user(
    db: AsyncSession,
    *,
    google_id: str,
    email: str,
    name: str,
    profile_picture: str | None,
) -> User:
    user = await get_by_google_id(db, google_id)
    if user is None:
        user = await get_by_email(db, email)

    if user is None:
        user = await create(
            db,
            name=name,
            email=email,
            profile_picture=profile_picture,
            google_id=google_id,
        )
    else:
        # Link google_id if this email was already registered via password
        if user.google_id is None:
            user.google_id = google_id
        if profile_picture and not user.profile_picture:
            user.profile_picture = profile_picture

    await db.flush()
    return user
