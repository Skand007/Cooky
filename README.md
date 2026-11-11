# Cooky

A kitchen inventory tracker and recipe recommender, built for personal use. Anyone can browse
the site; only the owner can add or change anything.

## Stack

- **Backend:** FastAPI, SQLAlchemy 2, Alembic, PostgreSQL (Neon) in production / SQLite locally
- **Frontend:** React, TypeScript, Vite, Tailwind CSS — mobile-first, installable to a phone's home screen
- **Hosting:** Vercel (both the frontend and the Python backend, as serverless functions)
- **Recipes:** Spoonacular API, a Gemini-powered recommendation bot, and the owner's own custom recipes
- **Tests:** pytest (backend), Vitest + Testing Library (frontend)
- **CI:** GitHub Actions — lint and test on every push and pull request

## Project layout

```
backend/    FastAPI app, Alembic migrations, pytest tests
frontend/   React app (Vite + Tailwind), Vitest tests
```

## Local development

### Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env   # edit OWNER_PASSWORD at least
uvicorn app.main:app --reload
```

The owner account is created automatically on first run from `OWNER_USERNAME`/`OWNER_PASSWORD`
in `.env`.

Run tests: `pytest`. Lint: `ruff check .`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Run tests: `npm run test`. Lint: `npm run lint`.

## Themes

Four built-in themes, switchable from the header and remembered per device: **Citrus** and
**Linen** (light), **Midnight** and **Charcoal** (dark).

## Status

**Phase 1:** project skeleton, owner login, the four themes, mobile-first layout, CI, and a
first deployment.

**Phase 2 (this commit):** the item catalogue (seeded with ~130 common ingredients, including
Indian staples, each with its locations, same-ingredient aliases — "spring onion" = "scallion" —
and a default unit), typed-entry inventory across Fridge/Freezer/Shelf/Room with quantities and
expiry dates, a "use up" flag per item, and the shopping list with a bought/not-bought split.
Adding an item not yet in the catalogue creates it on the fly. All of it is public to browse;
only the owner can add, edit, or delete.

Next: recipes — Spoonacular search, the owner's own custom recipes, and the Gemini-powered bot
that reads the current inventory — followed by the missing-ingredient and time/diet filters,
and the stats page.
