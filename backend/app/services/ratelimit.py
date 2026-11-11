"""Rate limits for the public chat bot, so a shared free Gemini quota can't be drained.

Per-visitor limit: in memory, per server instance (best effort on serverless, which
is fine for stopping a button-masher). Daily limit: counted in the database so it
holds across instances.
"""

import time
from collections import defaultdict, deque
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.meta import AppMeta

_recent: dict[str, deque] = defaultdict(deque)


def check_visitor(ip: str, per_minute: int, now: float | None = None) -> bool:
    """True if this visitor may send another message (and records it)."""
    now = time.monotonic() if now is None else now
    window = _recent[ip]
    while window and now - window[0] > 60:
        window.popleft()
    if len(window) >= per_minute:
        return False
    window.append(now)
    return True


def take_daily(db: Session, limit: int) -> bool:
    """True if today's public budget has room (and uses one unit of it)."""
    key = "chat_count:" + datetime.now(timezone.utc).strftime("%Y-%m-%d")
    row = db.get(AppMeta, key)
    used = int(row.value) if row else 0
    if used >= limit:
        return False
    if row is None:
        db.add(AppMeta(key=key, value="1"))
    else:
        row.value = str(used + 1)
    db.commit()
    return True


def reset() -> None:
    _recent.clear()
