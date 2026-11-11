from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, field_validator

from app.models.inventory import LOCATIONS
from app.schemas.item import ItemOut


class StockIn(BaseModel):
    """Move bought shopping-list entries into the inventory."""

    location: str
    expiry_date: date | None = None

    @field_validator("location")
    @classmethod
    def valid_location(cls, v: str) -> str:
        if v not in LOCATIONS:
            raise ValueError(f"location must be one of {LOCATIONS}")
        return v


class StockOut(BaseModel):
    moved: list[str]


class ShoppingCreate(BaseModel):
    item_id: int | None = None
    new_item_name: str | None = None
    quantity: float | None = None
    unit: str | None = None
    note: str | None = None


class ShoppingUpdate(BaseModel):
    quantity: float | None = None
    unit: str | None = None
    note: str | None = None
    bought: bool | None = None


class ShoppingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    item: ItemOut
    quantity: float | None
    unit: str | None
    note: str | None
    bought: bool
    in_stock: bool = False  # already in the inventory (and not flagged use-up)
    added_at: datetime
