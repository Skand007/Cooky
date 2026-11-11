"""The catalogue of buyable/addable ingredients.

Typed entry only: inventory and shopping-list rows always point at one of
these, never a free-text name. ``aliases`` lets one catalogue entry answer to
several names ("spring onion" == "scallion" == "green onion") so search and,
later, recipe-ingredient matching treat them as the same thing.
"""

from sqlalchemy import JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Item(Base):
    __tablename__ = "items"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    category: Mapped[str | None] = mapped_column(String(60), nullable=True)
    default_unit: Mapped[str | None] = mapped_column(String(20), nullable=True)
    aliases: Mapped[list[str]] = mapped_column(JSON, default=list)

    inventory_entries: Mapped[list["InventoryEntry"]] = relationship(  # noqa: F821
        back_populates="item", cascade="all, delete-orphan"
    )
    shopping_entries: Mapped[list["ShoppingListEntry"]] = relationship(  # noqa: F821
        back_populates="item", cascade="all, delete-orphan"
    )
