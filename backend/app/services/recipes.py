"""Recipe logic: time categories, matching a recipe to the inventory, ranking
suggestions, serialising, and deducting ingredients when something is cooked."""

import re
from dataclasses import dataclass, field
from datetime import date

from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.models.inventory import InventoryEntry
from app.models.recipe import CookLog, Recipe, RecipeIngredient
from app.schemas.recipe import RecipeIngredientOut, RecipeOut, SuggestionOut
from app.services.diet import recipe_diets

EXPIRING_DAYS = 3
TIME_FILTERS = ["10min", "30min", "1hour", "meal_prep", "slow"]

_SLOW = re.compile(r"\b(overnight|soak(?:ed|ing)?|ferment\w*|marinat\w*\s+(?:for\s+)?\d+\s*(?:hours?|hrs?))\b", re.I)
_MEAL_PREP = re.compile(r"meal[\s-]?prep", re.I)


def guess_style(title: str, description: str | None, steps: list[str], total: int | None) -> str:
    """Slow = overnight soak/ferment/long marinade or 3h+; meal prep = says so."""
    if _MEAL_PREP.search(f"{title} {description or ''}"):
        return "meal_prep"
    if total is not None and total >= 180:
        return "slow"
    if any(_SLOW.search(step) for step in steps):
        return "slow"
    return "regular"


def time_category(style: str, total: int | None) -> str:
    if style != "regular":
        return style
    if total is None:
        return "unknown"
    if total <= 10:
        return "10min"
    if total <= 30:
        return "30min"
    if total <= 60:
        return "1hour"
    return "long"


def matches_time(recipe: Recipe, wanted: str) -> bool:
    if wanted in ("meal_prep", "slow"):
        return recipe.style == wanted
    limit = {"10min": 10, "30min": 30, "1hour": 60}.get(wanted)
    if limit is None:
        return True
    return recipe.style == "regular" and recipe.total_minutes is not None and recipe.total_minutes <= limit


@dataclass
class InventoryContext:
    have: set[int] = field(default_factory=set)
    use_up: set[int] = field(default_factory=set)
    expiring: set[int] = field(default_factory=set)


def inventory_context(db: Session, today: date | None = None) -> InventoryContext:
    """What's usable right now: in stock, not past its expiry date."""
    today = today or date.today()
    ctx = InventoryContext()
    for entry in db.query(InventoryEntry).all():
        if entry.quantity <= 0:
            continue
        if entry.expiry_date is not None and entry.expiry_date < today:
            continue
        ctx.have.add(entry.item_id)
        if entry.use_up:
            ctx.use_up.add(entry.item_id)
        if entry.expiry_date is not None and (entry.expiry_date - today).days <= EXPIRING_DAYS:
            ctx.expiring.add(entry.item_id)
    return ctx


@dataclass
class Evaluation:
    available: dict[int, bool]  # recipe_ingredient.id -> available
    have: list[str]
    missing: list[str]
    use_up_hits: list[str]
    expiring_hits: list[str]
    use_up_weight: int


def evaluate(recipe: Recipe, ctx: InventoryContext, assume_staples: bool = True) -> Evaluation:
    available, have, missing, use_up_hits, expiring_hits = {}, [], [], [], []
    weight = 0
    for ing in recipe.ingredients:
        item = ing.item
        ok = item.id in ctx.have or (assume_staples and item.staple)
        available[ing.id] = ok
        if not ok:
            missing.append(item.name)
            continue
        have.append(item.name)
        if item.id in ctx.use_up:
            use_up_hits.append(item.name)
            weight += 3 if ing.is_main else 1
        if item.id in ctx.expiring:
            expiring_hits.append(item.name)
    return Evaluation(available, have, missing, use_up_hits, expiring_hits, weight)


def cook_stats(db: Session) -> dict[int, tuple[int, object]]:
    rows = (
        db.query(CookLog.recipe_id, func.count(CookLog.id), func.max(CookLog.cooked_at))
        .filter(CookLog.recipe_id.isnot(None))
        .group_by(CookLog.recipe_id)
        .all()
    )
    return {recipe_id: (count, last) for recipe_id, count, last in rows}


def to_recipe_out(
    recipe: Recipe,
    ctx: InventoryContext | None = None,
    assume_staples: bool = True,
    stats: dict | None = None,
) -> RecipeOut:
    evaluation = evaluate(recipe, ctx, assume_staples) if ctx is not None else None
    count, last = (stats or {}).get(recipe.id, (0, None))
    ingredients = []
    for ing in recipe.ingredients:
        out = RecipeIngredientOut.model_validate(ing)
        if evaluation is not None:
            out.available = evaluation.available[ing.id]
        ingredients.append(out)
    return RecipeOut(
        id=recipe.id,
        title=recipe.title,
        description=recipe.description,
        servings=recipe.servings,
        prep_minutes=recipe.prep_minutes,
        cook_minutes=recipe.cook_minutes,
        total_minutes=recipe.total_minutes,
        style=recipe.style,
        time_category=time_category(recipe.style, recipe.total_minutes),
        diets=recipe_diets(i.item for i in recipe.ingredients),
        source=recipe.source,
        source_url=recipe.source_url,
        steps=recipe.steps or [],
        created_at=recipe.created_at,
        times_cooked=count,
        last_cooked=last,
        ingredients=ingredients,
    )


def load_recipes(db: Session):
    return db.query(Recipe).options(selectinload(Recipe.ingredients).selectinload(RecipeIngredient.item))


def suggest(
    db: Session,
    *,
    max_missing: int | None = None,
    time: str | None = None,
    diet: str | None = None,
    use_up: bool = False,
    staples: bool = True,
    q: str | None = None,
    limit: int | None = None,
    today: date | None = None,
) -> list[SuggestionOut]:
    ctx = inventory_context(db, today)
    stats = cook_stats(db)
    results = []
    for recipe in load_recipes(db).all():
        if not recipe.ingredients:
            continue  # nothing to match against
        if q and q.lower() not in recipe.title.lower():
            continue
        if time and not matches_time(recipe, time):
            continue
        out = to_recipe_out(recipe, ctx, staples, stats)
        if diet and diet not in out.diets:
            continue
        ev = evaluate(recipe, ctx, staples)
        if max_missing is not None and len(ev.missing) > max_missing:
            continue
        if use_up and not ev.use_up_hits:
            continue
        total = len(recipe.ingredients)
        score = ev.use_up_weight * 3 + len(ev.expiring_hits) * 2 + len(ev.have) / total * 5 - len(ev.missing) * 1.5
        results.append(
            (
                ev,
                SuggestionOut(
                    recipe=out,
                    have=ev.have,
                    missing=ev.missing,
                    missing_count=len(ev.missing),
                    use_up_hits=ev.use_up_hits,
                    expiring_hits=ev.expiring_hits,
                    score=round(score, 2),
                ),
            )
        )

    def sort_key(pair):
        ev, s = pair
        minutes = s.recipe.total_minutes if s.recipe.total_minutes is not None else 999
        if use_up:
            return (-ev.use_up_weight, s.missing_count, minutes)
        return (s.missing_count, -len(ev.expiring_hits), -ev.use_up_weight, minutes)

    results.sort(key=sort_key)
    suggestions = [s for _, s in results]
    return suggestions[:limit] if limit else suggestions


def _norm_unit(unit: str | None) -> str:
    return (unit or "").strip().lower()


def deduct_from_inventory(db: Session, recipe: Recipe) -> tuple[list[str], list[str]]:
    """Subtract a recipe's ingredient amounts from stock, soonest-expiring first.

    Only deducts when the inventory entry uses the same unit as the recipe (no
    guessing at conversions); everything else is reported as skipped so the owner
    can adjust by hand. Staples are ignored.
    """
    deducted, skipped = [], []
    for ing in recipe.ingredients:
        item = ing.item
        if item.staple:
            continue
        if ing.quantity is None:
            skipped.append(f"{item.name} (no amount in recipe)")
            continue
        entries = (
            db.query(InventoryEntry)
            .filter(InventoryEntry.item_id == item.id, InventoryEntry.quantity > 0)
            .all()
        )
        same_unit = [e for e in entries if _norm_unit(e.unit) == _norm_unit(ing.unit)]
        if not same_unit:
            reason = "different unit" if entries else "not in inventory"
            skipped.append(f"{item.name} ({reason})")
            continue
        same_unit.sort(key=lambda e: (e.expiry_date is None, e.expiry_date or date.max, e.added_at))
        remaining = ing.quantity
        for entry in same_unit:
            if remaining <= 0:
                break
            take = min(entry.quantity, remaining)
            entry.quantity -= take
            remaining -= take
            if entry.quantity <= 1e-9:
                db.delete(entry)
        used = ing.quantity - max(remaining, 0)
        deducted.append(f"{item.name} −{used:g} {ing.unit or ''}".strip())
        if remaining > 1e-9:
            skipped.append(f"{item.name} (only had {used:g} of {ing.quantity:g})")
    return deducted, skipped
