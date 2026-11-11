from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.recipe import STYLES
from app.schemas.item import ItemOut


class RecipeIngredientIn(BaseModel):
    item_id: int | None = None
    new_item_name: str | None = None
    quantity: float | None = None
    unit: str | None = None
    note: str | None = None
    is_main: bool = False


class RecipeIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    servings: int = Field(default=2, ge=1, le=100)
    prep_minutes: int | None = Field(default=None, ge=0, le=10000)
    cook_minutes: int | None = Field(default=None, ge=0, le=10000)
    style: str | None = None  # None = guess from the steps and total time
    steps: list[str] = []
    ingredients: list[RecipeIngredientIn] = []

    @field_validator("style")
    @classmethod
    def valid_style(cls, v: str | None) -> str | None:
        if v is not None and v not in STYLES:
            raise ValueError(f"style must be one of {STYLES}")
        return v


class RecipeIngredientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    item: ItemOut
    quantity: float | None
    unit: str | None
    note: str | None
    is_main: bool
    available: bool | None = None  # filled in when compared with the inventory


class RecipeOut(BaseModel):
    id: int
    title: str
    description: str | None
    servings: int
    prep_minutes: int | None
    cook_minutes: int | None
    total_minutes: int | None
    style: str
    time_category: str
    diets: list[str]
    source: str
    source_url: str | None
    steps: list[str]
    created_at: datetime
    times_cooked: int = 0
    last_cooked: datetime | None = None
    ingredients: list[RecipeIngredientOut]


class SuggestionOut(BaseModel):
    recipe: RecipeOut
    have: list[str]
    missing: list[str]
    missing_count: int
    use_up_hits: list[str]
    expiring_hits: list[str]
    score: float


class CookedIn(BaseModel):
    note: str | None = Field(default=None, max_length=300)
    rating: int | None = Field(default=None, ge=1, le=5)
    deduct: bool = False


class CookLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    recipe_id: int | None
    recipe_title: str
    cooked_at: datetime
    note: str | None
    rating: int | None


class CookedOut(BaseModel):
    log: CookLogOut
    deducted: list[str]
    skipped: list[str]


class AddMissingOut(BaseModel):
    added: list[str]
    already_listed: list[str]
