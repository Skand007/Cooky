"""The kitchen chat bot: Gemini, grounded in what's actually in the inventory."""

from datetime import date

import httpx
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.inventory import InventoryEntry
from app.services.recipes import suggest

API_ROOT = "https://generativelanguage.googleapis.com/v1beta/models"
FALLBACK_MODELS = ["gemini-flash-latest", "gemini-3.5-flash", "gemini-2.5-flash"]
MAX_STOCK_LINES = 150
MAX_RECIPE_LINES = 40

INSTRUCTIONS = """You are Cooky, the friendly kitchen assistant inside Skand's personal recipe app.

Diet: Skand eats vegetarian. Some days he also eats eggs (eggetarian) and some days he cooks Jain: \
no meat, fish or eggs, and no onion, garlic, ginger, potato, carrot, beetroot, radish, turnip, sweet \
potato, mushroom or honey. Never suggest meat or fish. If he asks for Jain food, follow those rules strictly.

How to answer:
- Be short and practical. Plain text only: no markdown, no asterisks, no headings. Simple lines starting with "- " are fine.
- Treat only the ingredients under IN STOCK as available (salt, cooking oil and water are always assumed to be at home).
- Say which ingredients he has and which he would still need to buy. Do not pretend he has something he does not.
- Prefer ingredients marked USE UP or expiring soon when you suggest something.
- You may suggest saved recipes (listed below) by their exact title, or propose new dishes with a quick method.
- If he asks about something unrelated to cooking or food, politely steer back to cooking.
"""


class BotError(Exception):
    def __init__(self, status_code: int, message: str):
        super().__init__(message)
        self.status_code = status_code
        self.message = message


def build_system_prompt(db: Session, diet: str | None = None, today: date | None = None) -> str:
    today = today or date.today()
    lines = []
    entries = db.query(InventoryEntry).filter(InventoryEntry.quantity > 0).all()
    entries.sort(key=lambda e: (e.expiry_date is None, e.expiry_date or date.max, e.item.name))
    for e in entries[:MAX_STOCK_LINES]:
        parts = [f"- {e.item.name}: {e.quantity:g} {e.unit or ''}".rstrip(), f"({e.location})"]
        if e.expiry_date:
            days = (e.expiry_date - today).days
            parts.append("EXPIRED" if days < 0 else f"expires {e.expiry_date} ({days}d)")
        if e.use_up:
            parts.append("[USE UP]")
        lines.append(" ".join(parts))
    if len(entries) > MAX_STOCK_LINES:
        lines.append(f"- ...and {len(entries) - MAX_STOCK_LINES} more")
    stock = "\n".join(lines) or "(nothing recorded yet)"

    recipe_lines = []
    for s in suggest(db, diet=diet, limit=MAX_RECIPE_LINES):
        r = s.recipe
        minutes = f"{r.total_minutes} min" if r.total_minutes else "time unknown"
        need = "have everything" if not s.missing else "missing: " + ", ".join(s.missing)
        recipe_lines.append(f"- {r.title} — {minutes} — {need}")
    recipes = "\n".join(recipe_lines) or "(no saved recipes yet)"

    focus = f"\nThis chat is about {diet} food.\n" if diet else ""
    return f"{INSTRUCTIONS}{focus}\nToday is {today}.\n\nIN STOCK:\n{stock}\n\nSAVED RECIPES:\n{recipes}\n"


def _models() -> list[str]:
    configured = get_settings().gemini_model
    return list(dict.fromkeys([configured, *FALLBACK_MODELS]))


def call_gemini(system: str, messages: list[dict]) -> str:
    key = get_settings().gemini_api_key
    if not key:
        raise BotError(503, "The Gemini API key is not configured")
    body = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [
            {"role": "model" if m["role"] == "assistant" else "user", "parts": [{"text": m["content"]}]}
            for m in messages
        ],
        "generationConfig": {"temperature": 0.6, "maxOutputTokens": 2048},
    }
    for model in _models():
        try:
            response = httpx.post(
                f"{API_ROOT}/{model}:generateContent",
                headers={"x-goog-api-key": key, "Content-Type": "application/json"},
                json=body,
                timeout=45,
            )
        except httpx.HTTPError:
            raise BotError(502, "Could not reach Gemini") from None
        if response.status_code == 404:
            continue  # that model name is gone; try the next one
        if response.status_code == 429:
            raise BotError(429, "Gemini's free limit was reached for now. Try again in a minute.")
        if response.status_code in (400, 401, 403):
            raise BotError(502, "Gemini rejected the request. Check GEMINI_API_KEY in the backend settings.")
        if response.status_code != 200:
            raise BotError(502, f"Gemini returned an error ({response.status_code})")
        try:
            parts = response.json()["candidates"][0]["content"]["parts"]
            text = "".join(p.get("text", "") for p in parts).strip()
        except (KeyError, IndexError, TypeError, ValueError):
            text = ""
        if not text:
            raise BotError(502, "Gemini did not return an answer. Try rephrasing.")
        return text
    raise BotError(502, "No Gemini model was available. Set GEMINI_MODEL to a current model name.")
