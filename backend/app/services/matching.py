"""Matching free-text ingredient names to catalogue items.

Used when importing recipes (Spoonacular says "2 cups red onions, chopped"; the
catalogue knows "Onion"). Same-ingredient matching works off the item's name and
aliases, so "scallion" and "spring onion" land on the same item.

It is deliberately simple and transparent: exact match on normalised text first,
then the *longest* catalogue name/alias that appears as whole words inside the
ingredient text ("red onion" -> Onion, "coconut milk" -> Coconut milk, not
Milk). Anything unmatched becomes a new catalogue item so nothing is dropped.
"""

import re

from sqlalchemy.orm import Session

from app.models.item import Item
from app.services.diet import STAPLES, guess_diet


def _singular(word: str) -> str:
    if len(word) > 4 and word.endswith("ies"):
        return word[:-3] + "y"
    if len(word) > 4 and word.endswith("oes"):
        return word[:-2]
    if len(word) > 3 and word.endswith("s") and not word.endswith("ss"):
        return word[:-1]
    return word


def normalize(text: str) -> str:
    text = re.sub(r"\(.*?\)", " ", text.lower())
    text = text.split(",")[0]
    text = re.sub(r"[^a-z\s-]", " ", text).replace("-", " ")
    return " ".join(_singular(w) for w in text.split())


def display_name(text: str) -> str:
    text = re.sub(r"\(.*?\)", " ", text).split(",")[0]
    text = re.sub(r"\s+", " ", text).strip()
    return text[:1].upper() + text[1:].lower() if text else text


class ItemIndex:
    """Lookup of normalised name/alias -> Item, built once per import."""

    def __init__(self, db: Session):
        self.db = db
        self.keys: dict[str, Item] = {}
        for item in db.query(Item).all():
            self._add(item)

    def _add(self, item: Item) -> None:
        for label in [item.name, *(item.aliases or [])]:
            key = normalize(label)
            if key:
                self.keys.setdefault(key, item)

    def match(self, text: str) -> Item | None:
        normalized = normalize(text)
        if not normalized:
            return None
        if normalized in self.keys:
            return self.keys[normalized]
        padded = f" {normalized} "
        best_key = None
        for key in self.keys:
            if f" {key} " in padded and (best_key is None or len(key) > len(best_key)):
                best_key = key
        return self.keys[best_key] if best_key else None

    def get_or_create(self, text: str) -> Item:
        found = self.match(text)
        if found is not None:
            return found
        name = display_name(text)[:120]
        existing = self.db.query(Item).filter(Item.name.ilike(name)).first()
        if existing is not None:
            self._add(existing)
            return existing
        diet, jain_ok = guess_diet(name)
        item = Item(name=name, aliases=[], diet=diet, jain_ok=jain_ok, staple=name.lower() in STAPLES)
        self.db.add(item)
        self.db.flush()
        self._add(item)
        return item
