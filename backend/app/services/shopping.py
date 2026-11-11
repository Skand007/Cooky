"""Shopping-list helpers shared by the shopping, inventory and stats endpoints."""

from datetime import date

from sqlalchemy.orm import Session

from app.models.inventory import InventoryEntry
from app.models.shopping import ShoppingListEntry

USE_UP_NOTE = "use up"


def covered_item_ids(db: Session, today: date | None = None) -> set[int]:
    """Items that are in stock and not about to run out: they have a usable (not
    expired) entry and none of their entries is flagged "use up". Such items appear
    crossed out on the shopping list because there is nothing to buy."""
    today = today or date.today()
    have: set[int] = set()
    running_low: set[int] = set()
    for e in db.query(InventoryEntry).filter(InventoryEntry.quantity > 0).all():
        if e.expiry_date is not None and e.expiry_date < today:
            continue
        have.add(e.item_id)
        if e.use_up:
            running_low.add(e.item_id)
    return have - running_low


def annotate(db: Session, entries: list[ShoppingListEntry]) -> list[ShoppingListEntry]:
    covered = covered_item_ids(db)
    for entry in entries:
        entry.in_stock = entry.item_id in covered  # read by ShoppingOut
    return entries


def ensure_on_list(db: Session, item_id: int, note: str | None = None) -> bool:
    """Put an item on the shopping list unless it is already waiting to be bought.
    Returns True if a new line was added (caller commits)."""
    existing = (
        db.query(ShoppingListEntry)
        .filter(ShoppingListEntry.item_id == item_id, ShoppingListEntry.bought.is_(False))
        .first()
    )
    if existing is not None:
        return False
    db.add(ShoppingListEntry(item_id=item_id, note=note))
    return True
