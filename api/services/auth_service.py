from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from auth import create_access_token, hash_password, verify_password
from repositories import user_repository
from schemas import TokenResponse, UserRegister


async def register(db: AsyncSession, body: UserRegister) -> TokenResponse:
    existing = await user_repository.get_by_email(db, body.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = await user_repository.create(
        db,
        name=body.name,
        email=body.email,
        hashed_password=hash_password(body.password),
        profile_picture=body.profile_picture,
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user",
        )

    await db.commit()
    token = create_access_token(subject=body.email)
    return TokenResponse(access_token=token)


async def login(db: AsyncSession, email: str, password: str) -> TokenResponse:
    user = await user_repository.get_by_email(db, email)
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    token = create_access_token(subject=user.email)
    return TokenResponse(access_token=token)
