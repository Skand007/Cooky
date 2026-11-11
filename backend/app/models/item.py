"""The catalogue of buyable/addable ingredients.

Typed entry only: inventory, shopping-list and recipe rows always point at one
of these, never a free-text name. ``aliases`` lets one catalogue entry answer to
several names ("spring onion" == "scallion" == "green onion") so search, and
recipe-ingredient matching, treat them as the same thing.

``diet`` and ``jain_ok`` drive the vegetarian / eggetarian / Jain filters:
a recipe's diets are worked out from the items it uses. ``staple`` marks
things (salt, oil, water) that are assumed to be at home when matching recipes.
"""

from sqlalchemy import JSON, Boolean, String, false, true
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

DIETS = ["veg", "egg", "nonveg"]


class Item(Base):
    __tablename__ = "items"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    category: Mapped[str | None] = mapped_column(String(60), nullable=True)
    default_unit: Mapped[str | None] = mapped_column(String(20), nullable=True)
    aliases: Mapped[list[str]] = mapped_column(JSON, default=list)
    diet: Mapped[str] = mapped_column(String(10), default="veg", server_default="veg")
    jain_ok: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())
    staple: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())

    inventory_entries: Mapped[list["InventoryEntry"]] = relationship(  # noqa: F821
        back_populates="item", cascade="all, delete-orphan"
    )
    shopping_entries: Mapped[list["ShoppingListEntry"]] = relationship(  # noqa: F821
        back_populates="item", cascade="all, delete-orphan"
    )
