"""Tiny in-place schema upgrade for tables that already exist in production.

``Base.metadata.create_all`` creates missing *tables* but never alters existing
ones. When a column is added to a table that's already live (here: the diet,
jain_ok and staple flags on ``items``), this adds it. Safe to run on every
cold start: it only touches what is missing, and a lost race between two
simultaneous cold starts is ignored.
"""

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def ensure_item_columns(engine: Engine) -> None:
    inspector = inspect(engine)
    if "items" not in inspector.get_table_names():
        return
    existing = {col["name"] for col in inspector.get_columns("items")}

    is_postgres = engine.dialect.name == "postgresql"
    true_literal = "TRUE" if is_postgres else "1"
    false_literal = "FALSE" if is_postgres else "0"

    wanted = {
        "diet": "ALTER TABLE items ADD COLUMN diet VARCHAR(10) NOT NULL DEFAULT 'veg'",
        "jain_ok": f"ALTER TABLE items ADD COLUMN jain_ok BOOLEAN NOT NULL DEFAULT {true_literal}",
        "staple": f"ALTER TABLE items ADD COLUMN staple BOOLEAN NOT NULL DEFAULT {false_literal}",
    }
    for column, statement in wanted.items():
        if column in existing:
            continue
        try:
            with engine.begin() as conn:
                conn.execute(text(statement))
        except Exception:  # noqa: BLE001 - another cold start may have added it first
            pass
