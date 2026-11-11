from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import require_owner
from app.db.base import get_db
from app.models.item import Item
from app.schemas.item import ItemCreate, ItemOut

router = APIRouter(prefix="/items", tags=["items"])


@router.get("", response_model=list[ItemOut])
def list_items(search: str | None = None, db: Session = Depends(get_db)) -> list[Item]:
    query = db.query(Item)
    if search:
        like = f"%{search}%"
        # SQLite/Postgres can't index into a JSON array in a portable way, so
        # alias matching is done in Python below rather than in SQL.
        candidates = query.filter(or_(Item.name.ilike(like))).all()
        alias_matches = [
            item
            for item in db.query(Item).all()
            if any(search.lower() in alias.lower() for alias in item.aliases)
        ]
        seen = {item.id for item in candidates}
        candidates += [item for item in alias_matches if item.id not in seen]
        return sorted(candidates, key=lambda i: i.name)[:25]
    return query.order_by(Item.name).all()


@router.post("", response_model=ItemOut, status_code=status.HTTP_201_CREATED)
def create_item(
    payload: ItemCreate, db: Session = Depends(get_db), _owner=Depends(require_owner)
) -> Item:
    existing = db.query(Item).filter(Item.name.ilike(payload.name)).first()
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Item already exists")

    item = Item(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item
