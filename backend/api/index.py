"""Vercel entrypoint. Vercel's Python runtime serves `app` as the ASGI app."""

from app.main import app  # noqa: F401
