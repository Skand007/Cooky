"""App configuration, read from environment variables."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    database_url: str = "sqlite:///./cooky.db"

    # Auth
    secret_key: str = "dev-secret-change-me"
    access_token_expire_minutes: int = 60 * 24 * 14  # two weeks

    # Owner credentials (bootstraps the single owner account on first run)
    owner_username: str = "skand"
    owner_password: str = "changeme"

    # Third-party APIs (not needed until later phases)
    spoonacular_api_key: str | None = None
    gemini_api_key: str | None = None
    # Model names change over time; if Gemini ever answers "model not found",
    # set GEMINI_MODEL to a current one (the bot also falls back through a few).
    gemini_model: str = "gemini-flash-latest"
    # The bot is public so visitors can try it. The free Gemini quota is shared by
    # everyone, so public use is rate-limited (the owner is never limited).
    # Set CHAT_PUBLIC=false to make it owner-only again.
    chat_public: bool = True
    chat_daily_limit: int = 300  # public messages per UTC day, across all visitors
    chat_per_minute: int = 6  # public messages per visitor (IP) per minute

    # CORS
    frontend_origin: str = "http://localhost:5173"


@lru_cache
def get_settings() -> Settings:
    return Settings()
