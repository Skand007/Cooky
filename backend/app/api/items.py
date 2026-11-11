from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_owner
from app.db.base import get_db
from app.models.item import Item
from app.schemas.item import ItemCreate, ItemOut, ItemUpdate
from app.services.diet import guess_diet

router = APIRouter(prefix="/items", tags=["items"])


@router.get("", response_model=list[ItemOut])
def list_items(search: str | None = None, db: Session = Depends(get_db)) -> list[Item]:
    items = db.query(Item).order_by(Item.name).all()
    if not search:
        return items
    needle = search.lower()
    # Alias lists are JSON, which SQLite/Postgres can't search portably, so the
    # (small) catalogue is filtered here. Name matches come first.
    by_name = [i for i in items if needle in i.name.lower()]
    by_alias = [
        i
        for i in items
        if i not in by_name and any(needle in alias.lower() for alias in i.aliases or [])
    ]
    return (by_name + by_alias)[:25]


@router.post("", response_model=ItemOut, status_code=status.HTTP_201_CREATED)
def create_item(
    payload: ItemCreate, db: Session = Depends(get_db), _owner=Depends(require_owner)
) -> Item:
    if db.query(Item).filter(Item.name.ilike(payload.name.strip())).first() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Item already exists")

    guessed_diet, guessed_jain = guess_diet(payload.name)
    item = Item(
        name=payload.name.strip(),
        category=payload.category,
        default_unit=payload.default_unit,
        aliases=payload.aliases,
        diet=payload.diet or guessed_diet,
        jain_ok=guessed_jain if payload.jain_ok is None else payload.jain_ok,
        staple=payload.staple,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{item_id}", response_model=ItemOut)
def update_item(
    item_id: int,
    payload: ItemUpdate,
    db: Session = Depends(get_db),
    _owner=Depends(require_owner),
) -> Item:
    item = db.get(Item, item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    changes = payload.model_dump(exclude_unset=True)
    if "name" in changes:
        new_name = (changes["name"] or "").strip()
        clash = db.query(Item).filter(Item.name.ilike(new_name), Item.id != item_id).first()
        if not new_name or clash is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="Another item already has that name"
            )
        changes["name"] = new_name
    for field, value in changes.items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)
    return item
