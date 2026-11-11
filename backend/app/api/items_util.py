"""Shared helper: inventory, shopping-list and recipe rows all accept either an
existing catalogue item_id, or a new_item_name to create on the fly when the
owner typed something not yet in the catalogue.
"""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.item import Item
from app.services.diet import STAPLES, guess_diet


def resolve_item(db: Session, item_id: int | None, new_item_name: str | None) -> Item:
    if item_id is not None:
        item = db.get(Item, item_id)
        if item is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
        return item

    name = (new_item_name or "").strip()
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide either item_id or new_item_name",
        )

    existing = db.query(Item).filter(Item.name.ilike(name)).first()
    if existing is not None:
        return existing

    diet, jain_ok = guess_diet(name)
    item = Item(name=name, aliases=[], diet=diet, jain_ok=jain_ok, staple=name.lower() in STAPLES)
    db.add(item)
    db.flush()  # assigns item.id without committing yet
    return item
