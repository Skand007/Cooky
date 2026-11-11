from datetime import date

from pydantic import BaseModel


class StockLine(BaseModel):
    id: int
    name: str
    location: str
    expiry_date: date | None = None
    days_left: int | None = None


class InventoryStats(BaseModel):
    total: int
    by_location: dict[str, int]
    expiring_soon: list[StockLine]
    expired: list[StockLine]
    use_up: list[StockLine]


class ShoppingStats(BaseModel):
    open: int
    bought: int


class RecipeStats(BaseModel):
    total: int
    by_source: dict[str, int]
    by_time: dict[str, int]


class WeekCount(BaseModel):
    week_start: date
    count: int


class NameCount(BaseModel):
    name: str
    count: int


class CookingStats(BaseModel):
    total: int
    last_30_days: int
    average_rating: float | None
    by_week: list[WeekCount]
    top_recipes: list[NameCount]
    top_ingredients: list[NameCount]


class StatsOut(BaseModel):
    inventory: InventoryStats
    shopping: ShoppingStats
    recipes: RecipeStats
    cooking: CookingStats
