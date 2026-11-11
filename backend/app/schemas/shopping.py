from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.item import ItemOut


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
    added_at: datetime
