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

    # CORS
    frontend_origin: str = "http://localhost:5173"


@lru_cache
def get_settings() -> Settings:
    return Settings()
