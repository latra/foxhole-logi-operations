from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from dependencies import get_current_user
from schemas import TokenResponse, UserRegister, UserResponse
from services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(body: UserRegister, db: AsyncSession = Depends(get_db)):
    return await auth_service.register(db, body)


@router.post("/login", response_model=TokenResponse)
async def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    return await auth_service.login(db, form.username, form.password)


@router.get("/me", response_model=UserResponse)
async def me(current_user=Depends(get_current_user)):
    return current_user


if settings.google.enabled:
    from fastapi.responses import RedirectResponse
    from services import google_auth_service

    @router.get("/google/login", summary="Redirect to Google OAuth consent screen")
    async def google_login():
        url = google_auth_service.build_authorization_url()
        return RedirectResponse(url)

    @router.get("/google/callback", response_model=TokenResponse, summary="Google OAuth callback")
    async def google_callback(code: str, db: AsyncSession = Depends(get_db)):
        return await google_auth_service.handle_callback(db, code)
