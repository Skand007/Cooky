from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth
from app.core.config import get_settings
from app.core.security import hash_password
from app.db.base import Base, SessionLocal, engine
from app.models.owner import Owner

settings = get_settings()


def bootstrap_owner() -> None:
    """Create the single owner row from env vars if it doesn't exist yet.

    Safe to run on every cold start: it's a no-op once the row exists.
    """
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        existing = db.query(Owner).filter(Owner.username == settings.owner_username).first()
        if existing is None:
            db.add(
                Owner(
                    username=settings.owner_username,
                    password_hash=hash_password(settings.owner_password),
                )
            )
            db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    bootstrap_owner()
    yield


app = FastAPI(title="Cooky API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}
