from collections import Counter
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import require_owner
from app.db.base import get_db
from app.models.inventory import LOCATIONS, InventoryEntry
from app.models.recipe import CookLog, Recipe
from app.models.shopping import ShoppingListEntry
from app.schemas.recipe import CookLogOut
from app.schemas.stats import (
    CookingStats,
    InventoryStats,
    NameCount,
    RecipeStats,
    ShoppingStats,
    StatsOut,
    StockLine,
    WeekCount,
)
from app.services.recipes import EXPIRING_DAYS, time_category
from app.services.shopping import covered_item_ids

router = APIRouter(tags=["stats"])


def _line(entry: InventoryEntry, today: date) -> StockLine:
    days = (entry.expiry_date - today).days if entry.expiry_date else None
    return StockLine(
        id=entry.id,
        name=entry.item.name,
        location=entry.location,
        expiry_date=entry.expiry_date,
        days_left=days,
    )


@router.get("/stats", response_model=StatsOut)
def stats(db: Session = Depends(get_db)) -> StatsOut:
    today = date.today()

    entries = db.query(InventoryEntry).all()
    by_location = {loc: 0 for loc in LOCATIONS}
    for e in entries:
        by_location[e.location] = by_location.get(e.location, 0) + 1
    expiring = sorted(
        (e for e in entries if e.expiry_date and 0 <= (e.expiry_date - today).days <= EXPIRING_DAYS),
        key=lambda e: e.expiry_date,
    )
    expired = sorted((e for e in entries if e.expiry_date and e.expiry_date < today), key=lambda e: e.expiry_date)
    use_up = [e for e in entries if e.use_up]

    shopping = db.query(ShoppingListEntry).all()
    covered = covered_item_ids(db, today)
    recipes = db.query(Recipe).all()

    logs = db.query(CookLog).all()
    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=30)
    this_monday = today - timedelta(days=today.weekday())
    weeks = [this_monday - timedelta(weeks=n) for n in range(7, -1, -1)]
    week_counts = Counter(log.cooked_at.date() - timedelta(days=log.cooked_at.date().weekday()) for log in logs)
    ratings = [log.rating for log in logs if log.rating]

    return StatsOut(
        inventory=InventoryStats(
            total=len(entries),
            by_location=by_location,
            expiring_soon=[_line(e, today) for e in expiring],
            expired=[_line(e, today) for e in expired],
            use_up=[_line(e, today) for e in use_up],
        ),
        shopping=ShoppingStats(
            open=sum(1 for s in shopping if not s.bought and s.item_id not in covered),
            bought=sum(1 for s in shopping if s.bought),
        ),
        recipes=RecipeStats(
            total=len(recipes),
            by_source=dict(Counter(r.source for r in recipes)),
            by_time=dict(Counter(time_category(r.style, r.total_minutes) for r in recipes)),
        ),
        cooking=CookingStats(
            total=len(logs),
            last_30_days=sum(1 for log in logs if log.cooked_at >= cutoff),
            average_rating=round(sum(ratings) / len(ratings), 1) if ratings else None,
            by_week=[WeekCount(week_start=w, count=week_counts.get(w, 0)) for w in weeks],
            top_recipes=[
                NameCount(name=n, count=c) for n, c in Counter(log.recipe_title for log in logs).most_common(5)
            ],
            top_ingredients=[
                NameCount(name=n, count=c)
                for n, c in Counter(name for log in logs for name in set(log.ingredient_names or [])).most_common(8)
            ],
        ),
    )


@router.get("/history", response_model=list[CookLogOut])
def history(limit: int = Query(default=50, ge=1, le=500), db: Session = Depends(get_db)) -> list[CookLog]:
    return db.query(CookLog).order_by(CookLog.cooked_at.desc()).limit(limit).all()


@router.delete("/history/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_history(log_id: int, db: Session = Depends(get_db), _owner=Depends(require_owner)) -> None:
    log = db.get(CookLog, log_id)
    if log is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Log entry not found")
    db.delete(log)
    db.commit()
