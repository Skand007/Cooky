"""Spoonacular: search for vegetarian recipes and import one permanently.

Imported recipes are copied into Cooky's own database (matched to catalogue
items), so each one costs API quota once and then works offline from the
database forever. Spoonacular's "vegetarian" diet is lacto-ovo (eggs allowed);
whether a recipe is also Jain is worked out afterwards from the matched items.
"""

import html
import re

import httpx
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.recipe import Recipe, RecipeIngredient
from app.services.matching import ItemIndex
from app.services.recipes import guess_style

BASE_URL = "https://api.spoonacular.com"


class SpoonacularError(Exception):
    def __init__(self, status_code: int, message: str):
        super().__init__(message)
        self.status_code = status_code
        self.message = message


def _get(path: str, params: dict) -> dict:
    key = get_settings().spoonacular_api_key
    if not key:
        raise SpoonacularError(503, "Spoonacular API key is not configured")
    try:
        response = httpx.get(f"{BASE_URL}{path}", params={**params, "apiKey": key}, timeout=15)
    except httpx.HTTPError:
        raise SpoonacularError(502, "Could not reach Spoonacular") from None
    if response.status_code == 402:
        raise SpoonacularError(429, "Spoonacular's daily free quota is used up; try again tomorrow")
    if response.status_code in (401, 403):
        raise SpoonacularError(502, "Spoonacular rejected the API key")
    if response.status_code != 200:
        raise SpoonacularError(502, f"Spoonacular returned an error ({response.status_code})")
    return response.json()


def search(query: str, number: int = 10) -> list[dict]:
    data = _get(
        "/recipes/complexSearch",
        {"query": query, "diet": "vegetarian", "number": number, "addRecipeInformation": "true"},
    )
    return [
        {
            "id": r["id"],
            "title": r["title"],
            "ready_in_minutes": r.get("readyInMinutes"),
            "servings": r.get("servings"),
        }
        for r in data.get("results", [])
    ]


def information(spoonacular_id: int) -> dict:
    return _get(f"/recipes/{spoonacular_id}/information", {"includeNutrition": "false"})


def _plain(text: str | None) -> str:
    text = re.sub(r"<[^>]+>", " ", text or "")
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def _steps(data: dict) -> list[str]:
    steps = [
        s["step"].strip()
        for block in data.get("analyzedInstructions") or []
        for s in block.get("steps", [])
        if s.get("step", "").strip()
    ]
    if steps:
        return steps
    raw = re.sub(r"</?(li|p|br)[^>]*>", "\n", data.get("instructions") or "")
    return [line.strip() for line in html.unescape(re.sub(r"<[^>]+>", "", raw)).splitlines() if line.strip()]


def _minutes(value) -> int | None:
    return value if isinstance(value, int) and value > 0 else None


def import_recipe(db: Session, data: dict) -> Recipe:
    """Create a Recipe from a Spoonacular information payload (not yet committed)."""
    index = ItemIndex(db)
    steps = _steps(data)
    total = _minutes(data.get("readyInMinutes"))
    title = data["title"].strip()[:200]
    description = _plain(data.get("summary"))[:400] or None

    recipe = Recipe(
        title=title,
        description=description,
        servings=data.get("servings") or 2,
        prep_minutes=_minutes(data.get("preparationMinutes")),
        cook_minutes=_minutes(data.get("cookingMinutes")),
        total_minutes=total,
        style=guess_style(title, description, steps, total),
        steps=steps,
        source="spoonacular",
        source_id=str(data["id"]),
        source_url=data.get("sourceUrl") or data.get("spoonacularSourceUrl"),
    )
    seen: set[int] = set()
    for ing in data.get("extendedIngredients") or []:
        name = ing.get("nameClean") or ing.get("name") or ing.get("originalName") or ""
        if not name.strip():
            continue
        item = index.get_or_create(name)
        if item.id in seen:
            continue
        seen.add(item.id)
        amount = ing.get("amount")
        recipe.ingredients.append(
            RecipeIngredient(
                item=item,
                quantity=amount if isinstance(amount, (int, float)) and amount > 0 else None,
                unit=(ing.get("unit") or "").strip()[:20] or None,
                note=(ing.get("original") or "")[:200] or None,
            )
        )
    return recipe
