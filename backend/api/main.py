from contextlib import asynccontextmanager

import fastapi
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import Base, engine
from routes.auth_router import router as auth_router


@asynccontextmanager
async def lifespan(app: fastapi.FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = fastapi.FastAPI(title=settings.app.name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)


@app.get("/")
def read_root():
    return {"STATUS": "OK"}
