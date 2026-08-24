import base64
import uuid

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


def _generate_id() -> str:
    return base64.urlsafe_b64encode(uuid.uuid4().bytes).rstrip(b"=").decode()


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(22), primary_key=True, default=_generate_id)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    profile_picture: Mapped[str | None] = mapped_column(String(500), nullable=True)
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)
    google_id: Mapped[str | None] = mapped_column(String(128), unique=True, nullable=True, index=True)
