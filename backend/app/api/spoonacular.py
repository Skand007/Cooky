from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import require_owner
from app.db.base import get_db
from app.models.recipe import Recipe
from app.schemas.recipe import RecipeOut
from app.services import spoonacular
from app.services.recipes import inventory_context, load_recipes, to_recipe_out

# Owner-only: every call spends the owner's Spoonacular quota.
router = APIRouter(prefix="/spoonacular", tags=["spoonacular"], dependencies=[Depends(require_owner)])


@router.get("/search")
def search(query: str = Query(min_length=2, max_length=100), db: Session = Depends(get_db)) -> list[dict]:
    try:
        results = spoonacular.search(query)
    except spoonacular.SpoonacularError as err:
        raise HTTPException(status_code=err.status_code, detail=err.message) from None
    imported = {
        r.source_id for r in db.query(Recipe).filter(Recipe.source == "spoonacular").all()
    }
    return [{**r, "already_imported": str(r["id"]) in imported} for r in results]


@router.post("/import/{spoonacular_id}", response_model=RecipeOut)
def import_one(spoonacular_id: int, db: Session = Depends(get_db)) -> RecipeOut:
    existing = (
        load_recipes(db)
        .filter(Recipe.source == "spoonacular", Recipe.source_id == str(spoonacular_id))
        .first()
    )
    if existing is not None:  # already cached: no quota spent
        return to_recipe_out(existing, inventory_context(db))
    try:
        data = spoonacular.information(spoonacular_id)
    except spoonacular.SpoonacularError as err:
        raise HTTPException(status_code=err.status_code, detail=err.message) from None
    recipe = spoonacular.import_recipe(db, data)
    db.add(recipe)
    db.commit()
    return to_recipe_out(load_recipes(db).filter(Recipe.id == recipe.id).one(), inventory_context(db))
