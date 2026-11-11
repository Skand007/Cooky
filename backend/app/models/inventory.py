"""What's actually in the kitchen right now."""

from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

LOCATIONS = ["fridge", "freezer", "shelf", "room"]


class InventoryEntry(Base):
    __tablename__ = "inventory_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("items.id"))
    location: Mapped[str] = mapped_column(String(20))
    quantity: Mapped[float] = mapped_column(Float, default=1.0)
    unit: Mapped[str | None] = mapped_column(String(20), nullable=True)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    use_up: Mapped[bool] = mapped_column(Boolean, default=False)
    added_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    item: Mapped["Item"] = relationship(back_populates="inventory_entries")  # noqa: F821
