from pydantic import BaseModel, ConfigDict, field_validator

from app.models.item import DIETS


class ItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: str | None
    default_unit: str | None
    aliases: list[str]
    diet: str
    jain_ok: bool
    staple: bool


def _check_diet(v: str | None) -> str | None:
    if v is not None and v not in DIETS:
        raise ValueError(f"diet must be one of {DIETS}")
    return v


class ItemCreate(BaseModel):
    name: str
    category: str | None = None
    default_unit: str | None = None
    aliases: list[str] = []
    diet: str | None = None  # None = guess from the name
    jain_ok: bool | None = None  # None = guess from the name
    staple: bool = False

    _valid_diet = field_validator("diet")(_check_diet)


class ItemUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    default_unit: str | None = None
    aliases: list[str] | None = None
    diet: str | None = None
    jain_ok: bool | None = None
    staple: bool | None = None

    _valid_diet = field_validator("diet")(_check_diet)
