from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import require_owner
from app.api.items_util import resolve_item
from app.db.base import get_db
from app.models.recipe import CookLog, Recipe, RecipeIngredient
from app.models.shopping import ShoppingListEntry
from app.schemas.recipe import (
    AddMissingOut,
    CookedIn,
    CookedOut,
    CookLogOut,
    RecipeIn,
    RecipeOut,
    SuggestionOut,
)
from app.services.diet import DIET_TAGS
from app.services.recipes import (
    TIME_FILTERS,
    cook_stats,
    deduct_from_inventory,
    evaluate,
    guess_style,
    inventory_context,
    load_recipes,
    matches_time,
    suggest,
    to_recipe_out,
)

router = APIRouter(prefix="/recipes", tags=["recipes"])


def _check_filters(diet: str | None, time: str | None) -> None:
    if diet is not None and diet not in DIET_TAGS:
        raise HTTPException(status_code=422, detail=f"diet must be one of {DIET_TAGS}")
    if time is not None and time not in TIME_FILTERS:
        raise HTTPException(status_code=422, detail=f"time must be one of {TIME_FILTERS}")


def _get_recipe(db: Session, recipe_id: int) -> Recipe:
    recipe = load_recipes(db).filter(Recipe.id == recipe_id).first()
    if recipe is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found")
    return recipe


def _apply(db: Session, recipe: Recipe, payload: RecipeIn) -> None:
    recipe.title = payload.title.strip()
    recipe.description = payload.description
    recipe.servings = payload.servings
    recipe.prep_minutes = payload.prep_minutes
    recipe.cook_minutes = payload.cook_minutes
    if payload.prep_minutes is None and payload.cook_minutes is None:
        recipe.total_minutes = None
    else:
        recipe.total_minutes = (payload.prep_minutes or 0) + (payload.cook_minutes or 0)
    recipe.steps = [s.strip() for s in payload.steps if s.strip()]
    recipe.style = payload.style or guess_style(
        recipe.title, recipe.description, recipe.steps, recipe.total_minutes
    )

    items = [resolve_item(db, ing.item_id, ing.new_item_name) for ing in payload.ingredients]
    recipe.ingredients.clear()
    for ing, item in zip(payload.ingredients, items, strict=True):
        recipe.ingredients.append(
            RecipeIngredient(
                item=item,
                quantity=ing.quantity,
                unit=(ing.unit or "").strip() or None,
                note=ing.note,
                is_main=ing.is_main,
            )
        )


@router.get("/suggest", response_model=list[SuggestionOut])
def suggestions(
    max_missing: int | None = Query(default=None, ge=0),
    time: str | None = None,
    diet: str | None = None,
    use_up: bool = False,
    staples: bool = True,
    q: str | None = None,
    limit: int | None = Query(default=None, ge=1, le=100),
    db: Session = Depends(get_db),
) -> list[SuggestionOut]:
    _check_filters(diet, time)
    return suggest(
        db,
        max_missing=max_missing,
        time=time,
        diet=diet,
        use_up=use_up,
        staples=staples,
        q=q,
        limit=limit,
    )


@router.get("", response_model=list[RecipeOut])
def list_recipes(
    q: str | None = None,
    diet: str | None = None,
    time: str | None = None,
    source: str | None = None,
    db: Session = Depends(get_db),
) -> list[RecipeOut]:
    _check_filters(diet, time)
    ctx = inventory_context(db)
    stats = cook_stats(db)
    out = []
    for recipe in load_recipes(db).order_by(Recipe.title).all():
        if q and q.lower() not in recipe.title.lower():
            continue
        if source and recipe.source != source:
            continue
        if time and not matches_time(recipe, time):
            continue
        item = to_recipe_out(recipe, ctx, True, stats)
        if diet and diet not in item.diets:
            continue
        out.append(item)
    return out


@router.get("/{recipe_id}", response_model=RecipeOut)
def get_recipe(recipe_id: int, staples: bool = True, db: Session = Depends(get_db)) -> RecipeOut:
    recipe = _get_recipe(db, recipe_id)
    return to_recipe_out(recipe, inventory_context(db), staples, cook_stats(db))


@router.post("", response_model=RecipeOut, status_code=status.HTTP_201_CREATED)
def create_recipe(
    payload: RecipeIn, db: Session = Depends(get_db), _owner=Depends(require_owner)
) -> RecipeOut:
    recipe = Recipe(source="custom")
    _apply(db, recipe, payload)
    db.add(recipe)
    db.commit()
    return to_recipe_out(_get_recipe(db, recipe.id), inventory_context(db), True, {})


@router.put("/{recipe_id}", response_model=RecipeOut)
def update_recipe(
    recipe_id: int,
    payload: RecipeIn,
    db: Session = Depends(get_db),
    _owner=Depends(require_owner),
) -> RecipeOut:
    recipe = _get_recipe(db, recipe_id)
    _apply(db, recipe, payload)
    db.commit()
    return to_recipe_out(_get_recipe(db, recipe_id), inventory_context(db), True, cook_stats(db))


@router.delete("/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recipe(
    recipe_id: int, db: Session = Depends(get_db), _owner=Depends(require_owner)
) -> None:
    recipe = _get_recipe(db, recipe_id)
    # Cooking history is kept (it carries its own title snapshot), just unlinked.
    db.query(CookLog).filter(CookLog.recipe_id == recipe_id).update({"recipe_id": None})
    db.delete(recipe)
    db.commit()


@router.post("/{recipe_id}/cooked", response_model=CookedOut, status_code=status.HTTP_201_CREATED)
def mark_cooked(
    recipe_id: int,
    payload: CookedIn,
    db: Session = Depends(get_db),
    _owner=Depends(require_owner),
) -> CookedOut:
    recipe = _get_recipe(db, recipe_id)
    deducted, skipped = deduct_from_inventory(db, recipe) if payload.deduct else ([], [])
    log = CookLog(
        recipe_id=recipe.id,
        recipe_title=recipe.title,
        ingredient_names=[i.item.name for i in recipe.ingredients],
        cooked_at=datetime.now(timezone.utc),
        note=payload.note,
        rating=payload.rating,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return CookedOut(log=CookLogOut.model_validate(log), deducted=deducted, skipped=skipped)


@router.post("/{recipe_id}/shopping", response_model=AddMissingOut)
def add_missing_to_shopping(
    recipe_id: int,
    staples: bool = True,
    db: Session = Depends(get_db),
    _owner=Depends(require_owner),
) -> AddMissingOut:
    recipe = _get_recipe(db, recipe_id)
    evaluation = evaluate(recipe, inventory_context(db), staples)
    on_list = {
        e.item_id
        for e in db.query(ShoppingListEntry).filter(ShoppingListEntry.bought.is_(False)).all()
    }
    added, already = [], []
    for ing in recipe.ingredients:
        if evaluation.available[ing.id]:
            continue
        if ing.item_id in on_list:
            already.append(ing.item.name)
            continue
        db.add(
            ShoppingListEntry(
                item_id=ing.item_id,
                quantity=ing.quantity,
                unit=ing.unit or ing.item.default_unit,
                note=f"for {recipe.title}"[:200],
            )
        )
        on_list.add(ing.item_id)
        added.append(ing.item.name)
    db.commit()
    return AddMissingOut(added=added, already_listed=already)
