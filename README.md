# FastAPI Auth Template

FastAPI template with authentication and multi-database support.

## Setup

### 1. Install dependencies

This project uses `pyproject.toml` with optional dependencies for different databases.

#### Option A: With PostgreSQL (recommended for production)

```bash
uv sync --extra postgres
```

#### Option B: With SQLite (development/testing)

```bash
uv sync --extra sqlite
```

#### Option C: Everything (full development setup)

```bash
uv sync --extra dev
```

#### Without uv (using pip)

```bash
# With PostgreSQL
pip install -e ".[postgres]"

# With SQLite
pip install -e ".[sqlite]"

# Everything
pip install -e ".[dev]"
```

### 2. Configure the application

Configuration is split between `config.yaml` (non-sensitive settings) and `.env` (secrets).

**`config.yaml`** — structure, database host/port, token TTL, etc.:

```yaml
app:
  name: "FastAPI Backend"

database:
  type: "postgresql"   # sqlite | postgresql
  host: "localhost"
  port: 5432
  database: "mydb"

auth:
  access_token_expire_minutes: 60
```

**`.env`** — sensitive values only:

```bash
cp .env.sample .env
```

```env
SECRET_KEY=your_secret_key
ALLOWED_ORIGINS=*

POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password

# Only for SQLite
SQLITE_DB_PATH=./data.db
```

### 3. Google OAuth (optional)

First enable it in `config.yaml`:

```yaml
google:
  enabled: true
```

When `enabled` is `false` or the section is absent, no Google-related endpoints are registered and none of the Google libraries are imported.

Then:

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services → Credentials → Create OAuth 2.0 Client ID**.
2. Set the application type to **Web application**.
3. Add the redirect URI (must match `GOOGLE_REDIRECT_URI`): `http://localhost:8000/auth/google/callback`.
4. Copy the client ID and secret into `.env`:

```env
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback
```

OAuth flow:
- `GET /auth/google/login` — redirects to Google's consent screen.
- `GET /auth/google/callback?code=...` — exchanges the code, creates or links the user, and returns a JWT.

If a user already has an account with the same email, their Google ID is linked automatically. Email/password login remains unaffected.

### 4. Run the application

```bash
# With uv (recommended)
uv run fastapi dev api/main.py

# Or with uvicorn directly
cd api
uvicorn main:app --reload
```

## Project structure

```
config.yaml              # Non-sensitive app configuration
.env                     # Secrets (not committed)
api/
├── main.py              # Application entry point
├── config.py            # Settings class (loads yaml + env)
├── database.py          # Database engine setup
├── auth.py              # JWT utilities
├── models.py            # SQLAlchemy models
├── schemas.py           # Pydantic schemas
├── dependencies.py      # FastAPI dependencies
├── routes/              # API endpoints
└── services/
    ├── auth_service.py         # Email/password logic
    └── google_auth_service.py  # Google OAuth logic
```

## Configuration reference

| Source | Key | Description | Default |
|--------|-----|-------------|---------|
| `config.yaml` | `app.name` | Application name | `FastAPI Backend` |
| `config.yaml` | `database.type` | `sqlite` or `postgresql` | `sqlite` |
| `config.yaml` | `database.host/port/database` | PostgreSQL connection info | `localhost:5432/postgres` |
| `config.yaml` | `auth.access_token_expire_minutes` | JWT TTL | `60` |
| `.env` | `SECRET_KEY` | JWT signing key | `change-me-in-production` |
| `.env` | `POSTGRES_USER` / `POSTGRES_PASSWORD` | DB credentials | — |
| `.env` | `SQLITE_DB_PATH` | SQLite file path | `./data.db` |
| `.env` | `ALLOWED_ORIGINS` | CORS origins (comma-separated or `*`) | `*` |
| `config.yaml` | `google.enabled` | Enable Google OAuth endpoints | `false` |
| `.env` | `GOOGLE_CLIENT_ID` | Google OAuth client ID | — |
| `.env` | `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | — |
| `.env` | `GOOGLE_REDIRECT_URI` | Google OAuth redirect URI | `http://localhost:8000/auth/google/callback` |
