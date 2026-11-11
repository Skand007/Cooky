"""Keeps the catalogue in step with the starting list in app.data.catalogue.

Runs on startup but does real work only when CATALOGUE_VERSION changes (a Cooky
update adds items/aliases/flags): new items are inserted, and existing ones get
any new aliases merged in and diet/staple flags filled in — never overwriting a
flag the owner already changed, and never removing an alias the owner added.
"""

from sqlalchemy.orm import Session

from app.data.catalogue import CATALOGUE
from app.models.item import Item
from app.models.meta import AppMeta
from app.services.diet import STAPLES, guess_diet

CATALOGUE_VERSION = "3"
_KEY = "catalogue_version"


def sync_catalogue(db: Session) -> None:
    meta = db.get(AppMeta, _KEY)
    if meta is not None and meta.value == CATALOGUE_VERSION:
        return

    existing = {item.name.lower(): item for item in db.query(Item).all()}
    for name, category, default_unit, aliases in CATALOGUE:
        diet, jain_ok = guess_diet(name)
        staple = name.lower() in STAPLES
        item = existing.get(name.lower())
        if item is None:
            item = Item(
                name=name,
                category=category,
                default_unit=default_unit,
                aliases=list(aliases),
                diet=diet,
                jain_ok=jain_ok,
                staple=staple,
            )
            db.add(item)
            existing[name.lower()] = item
            continue

        known = {a.lower() for a in (item.aliases or [])}
        merged = list(item.aliases or []) + [a for a in aliases if a.lower() not in known]
        if merged != (item.aliases or []):
            item.aliases = merged
        if item.diet == "veg" and diet != "veg":
            item.diet = diet
        if item.jain_ok and not jain_ok:
            item.jain_ok = False
        if staple and not item.staple:
            item.staple = True

    if meta is None:
        db.add(AppMeta(key=_KEY, value=CATALOGUE_VERSION))
    else:
        meta.value = CATALOGUE_VERSION
    db.commit()
