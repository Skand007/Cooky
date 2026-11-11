from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, field_validator

from app.models.inventory import LOCATIONS
from app.schemas.item import ItemOut


class InventoryCreate(BaseModel):
    item_id: int | None = None
    new_item_name: str | None = None
    location: str
    quantity: float = 1.0
    unit: str | None = None
    expiry_date: date | None = None

    @field_validator("location")
    @classmethod
    def valid_location(cls, v: str) -> str:
        if v not in LOCATIONS:
            raise ValueError(f"location must be one of {LOCATIONS}")
        return v


class InventoryUpdate(BaseModel):
    location: str | None = None
    quantity: float | None = None
    unit: str | None = None
    expiry_date: date | None = None
    use_up: bool | None = None

    @field_validator("location")
    @classmethod
    def valid_location(cls, v: str | None) -> str | None:
        if v is not None and v not in LOCATIONS:
            raise ValueError(f"location must be one of {LOCATIONS}")
        return v


class InventoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    item: ItemOut
    location: str
    quantity: float
    unit: str | None
    expiry_date: date | None
    use_up: bool
    added_at: datetime
