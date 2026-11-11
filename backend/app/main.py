from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, inventory, items, shopping
from app.core.config import get_settings
from app.core.security import hash_password
from app.data.catalogue import CATALOGUE
from app.db.base import Base, SessionLocal, engine
from app.models.item import Item
from app.models.owner import Owner

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


def bootstrap_catalogue(db) -> None:
    """Seed the item catalogue once. A non-empty table means this already
    ran (or the owner has since added their own items), so it's skipped.
    """
    if db.query(Item).first() is not None:
        return
    for name, category, default_unit, aliases in CATALOGUE:
        db.add(Item(name=name, category=category, default_unit=default_unit, aliases=aliases))
    db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        bootstrap_owner(db)
        bootstrap_catalogue(db)
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


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}
