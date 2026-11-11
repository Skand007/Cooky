from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_owner
from app.api.items_util import resolve_item
from app.db.base import get_db
from app.models.shopping import ShoppingListEntry
from app.schemas.shopping import ShoppingCreate, ShoppingOut, ShoppingUpdate

router = APIRouter(prefix="/shopping-list", tags=["shopping-list"])


@router.get("", response_model=list[ShoppingOut])
def list_shopping(db: Session = Depends(get_db)) -> list[ShoppingListEntry]:
    return (
        db.query(ShoppingListEntry)
        .order_by(ShoppingListEntry.bought, ShoppingListEntry.added_at.desc())
        .all()
    )


@router.post("", response_model=ShoppingOut, status_code=status.HTTP_201_CREATED)
def add_shopping(
    payload: ShoppingCreate, db: Session = Depends(get_db), _owner=Depends(require_owner)
) -> ShoppingListEntry:
    item = resolve_item(db, payload.item_id, payload.new_item_name)
    entry = ShoppingListEntry(
        item=item,
        quantity=payload.quantity,
        unit=payload.unit or item.default_unit,
        note=payload.note,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.patch("/{entry_id}", response_model=ShoppingOut)
def update_shopping(
    entry_id: int,
    payload: ShoppingUpdate,
    db: Session = Depends(get_db),
    _owner=Depends(require_owner),
) -> ShoppingListEntry:
    entry = db.get(ShoppingListEntry, entry_id)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(entry, field, value)

    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_shopping(
    entry_id: int, db: Session = Depends(get_db), _owner=Depends(require_owner)
) -> None:
    entry = db.get(ShoppingListEntry, entry_id)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")
    db.delete(entry)
    db.commit()
