from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, chat, inventory, items, recipes, shopping, spoonacular, stats
from app.core.config import get_settings
from app.core.security import hash_password
from app.db.base import Base, SessionLocal, engine
from app.db.upgrade import ensure_item_columns
from app.models.owner import Owner
from app.services.catalogue import sync_catalogue

settings = get_settings()


def bootstrap_owner(db) -> None:
    """Create the single owner row from env vars if it doesn't exist yet.

    Safe to run on every cold start: it's a no-op once the row exists.
    """
    existing = db.query(Owner).filter(Owner.username == settings.owner_username).first()
    if existing is None:
        db.add(
            Owner(
                username=settings.owner_username,
                password_hash=hash_password(settings.owner_password),
            )
        )
        db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_item_columns(engine)  # older databases lack the Phase 3 item columns
    db = SessionLocal()
    try:
        bootstrap_owner(db)
        sync_catalogue(db)
    finally:
        db.close()
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
app.include_router(items.router, prefix="/api")
app.include_router(inventory.router, prefix="/api")
app.include_router(shopping.router, prefix="/api")
app.include_router(recipes.router, prefix="/api")
app.include_router(stats.router, prefix="/api")
app.include_router(spoonacular.router, prefix="/api")
app.include_router(chat.router, prefix="/api")


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}
