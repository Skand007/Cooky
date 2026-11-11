from pydantic import BaseModel, ConfigDict


class ItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: str | None
    default_unit: str | None
    aliases: list[str]


class ItemCreate(BaseModel):
    name: str
    category: str | None = None
    default_unit: str | None = None
    aliases: list[str] = []
