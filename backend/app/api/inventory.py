from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_owner
from app.api.items_util import resolve_item
from app.db.base import get_db
from app.models.inventory import InventoryEntry
from app.schemas.inventory import InventoryCreate, InventoryOut, InventoryUpdate

router = APIRouter(prefix="/inventory", tags=["inventory"])


@router.get("", response_model=list[InventoryOut])
def list_inventory(
    location: str | None = None, db: Session = Depends(get_db)
) -> list[InventoryEntry]:
    query = db.query(InventoryEntry)
    if location:
        query = query.filter(InventoryEntry.location == location)
    return query.order_by(InventoryEntry.added_at.desc()).all()


@router.post("", response_model=InventoryOut, status_code=status.HTTP_201_CREATED)
def add_inventory(
    payload: InventoryCreate, db: Session = Depends(get_db), _owner=Depends(require_owner)
) -> InventoryEntry:
    item = resolve_item(db, payload.item_id, payload.new_item_name)
    entry = InventoryEntry(
        item=item,
        location=payload.location,
        quantity=payload.quantity,
        unit=payload.unit or item.default_unit,
        expiry_date=payload.expiry_date,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.patch("/{entry_id}", response_model=InventoryOut)
def update_inventory(
    entry_id: int,
    payload: InventoryUpdate,
    db: Session = Depends(get_db),
    _owner=Depends(require_owner),
) -> InventoryEntry:
    entry = db.get(InventoryEntry, entry_id)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(entry, field, value)

    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_inventory(
    entry_id: int, db: Session = Depends(get_db), _owner=Depends(require_owner)
) -> None:
    entry = db.get(InventoryEntry, entry_id)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")
    db.delete(entry)
    db.commit()
