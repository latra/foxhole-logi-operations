import os
from dataclasses import dataclass, field
from pathlib import Path

import yaml
from dotenv import load_dotenv

load_dotenv()

_CONFIG_PATH = Path(__file__).parent.parent / "config.yaml"


def _load_yaml() -> dict:
    if _CONFIG_PATH.exists():
        with open(_CONFIG_PATH) as f:
            return yaml.safe_load(f) or {}
    return {}


@dataclass
class AppConfig:
    name: str = "FastAPI Backend"


@dataclass
class DatabaseConfig:
    type: str = "sqlite"
    host: str = "localhost"
    port: int = 5432
    database: str = "postgres"
    # Sensitive — from env
    user: str = field(default_factory=lambda: os.getenv("POSTGRES_USER", "postgres"))
    password: str = field(default_factory=lambda: os.getenv("POSTGRES_PASSWORD", "postgres"))
    sqlite_path: str = field(default_factory=lambda: os.getenv("SQLITE_DB_PATH", "./data.db"))

    def url(self) -> str:
        if self.type == "sqlite":
            return f"sqlite+aiosqlite:///{self.sqlite_path}"
        if self.type == "postgresql":
            return f"postgresql+asyncpg://{self.user}:{self.password}@{self.host}:{self.port}/{self.database}"
        raise ValueError(f"Unsupported database type: {self.type!r}. Use 'sqlite' or 'postgresql'.")


@dataclass
class AuthConfig:
    access_token_expire_minutes: int = 60
    algorithm: str = "HS256"
    # Sensitive — from env
    secret_key: str = field(default_factory=lambda: os.getenv("SECRET_KEY", "change-me-in-production"))


@dataclass
class GoogleOAuthConfig:
    enabled: bool = False
    # Sensitive — from env
    client_id: str = field(default_factory=lambda: os.getenv("GOOGLE_CLIENT_ID", ""))
    client_secret: str = field(default_factory=lambda: os.getenv("GOOGLE_CLIENT_SECRET", ""))
    redirect_uri: str = field(default_factory=lambda: os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/google/callback"))


@dataclass
class CorsConfig:
    allowed_origins: list[str] = field(default_factory=lambda: ["*"])


@dataclass
class Settings:
    app: AppConfig = field(default_factory=AppConfig)
    database: DatabaseConfig = field(default_factory=DatabaseConfig)
    auth: AuthConfig = field(default_factory=AuthConfig)
    google: GoogleOAuthConfig = field(default_factory=GoogleOAuthConfig)
    cors: CorsConfig = field(default_factory=CorsConfig)

    @classmethod
    def load(cls) -> "Settings":
        raw = _load_yaml()

        app_cfg = AppConfig(**raw.get("app", {}))

        db_raw = raw.get("database", {})
        db_cfg = DatabaseConfig(
            type=db_raw.get("type", "sqlite"),
            host=db_raw.get("host", "localhost"),
            port=int(db_raw.get("port", 5432)),
            database=db_raw.get("database", "postgres"),
        )

        auth_raw = raw.get("auth", {})
        auth_cfg = AuthConfig(
            access_token_expire_minutes=int(
                auth_raw.get("access_token_expire_minutes", 60)
            ),
        )

        google_raw = raw.get("google", {})
        google_cfg = GoogleOAuthConfig(
            enabled=bool(google_raw.get("enabled", False)),
        )

        cors_raw = raw.get("cors", {})
        origins_env = os.getenv("ALLOWED_ORIGINS")
        if origins_env:
            origins = ["*"] if origins_env.strip() == "*" else [o.strip() for o in origins_env.split(",")]
        else:
            origins = cors_raw.get("allowed_origins", ["*"])
        cors_cfg = CorsConfig(allowed_origins=origins)

        return cls(app=app_cfg, database=db_cfg, auth=auth_cfg, google=google_cfg, cors=cors_cfg)


settings = Settings.load()
