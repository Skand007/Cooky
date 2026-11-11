from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import bearer_scheme, require_owner
from app.core.config import get_settings
from app.db.base import get_db
from app.services.bot import BotError, build_system_prompt, call_gemini
from app.services.diet import DIET_TAGS
from app.services.ratelimit import check_visitor, take_daily

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2000)


class ChatIn(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=20)
    diet: str | None = None


class ChatOut(BaseModel):
    reply: str


def chat_actor(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> str:
    """"owner" for a valid owner token, "visitor" for everyone else when the bot is
    public. When CHAT_PUBLIC=false, visitors get a 401."""
    try:
        require_owner(credentials, db)
        return "owner"
    except HTTPException:
        if get_settings().chat_public:
            return "visitor"
        raise


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.get("/status")
def chat_status() -> dict:
    settings = get_settings()
    return {"configured": bool(settings.gemini_api_key), "public": settings.chat_public}


@router.post("", response_model=ChatOut)
def chat(
    payload: ChatIn,
    request: Request,
    db: Session = Depends(get_db),
    actor: str = Depends(chat_actor),
) -> ChatOut:
    if payload.messages[-1].role != "user":
        raise HTTPException(status_code=422, detail="The last message must be from the user")
    if payload.diet is not None and payload.diet not in DIET_TAGS:
        raise HTTPException(status_code=422, detail=f"diet must be one of {DIET_TAGS}")
    if actor == "visitor":
        settings = get_settings()
        if not check_visitor(client_ip(request), settings.chat_per_minute):
            raise HTTPException(status_code=429, detail="Easy there! Please wait a minute before asking again.")
        if not take_daily(db, settings.chat_daily_limit):
            raise HTTPException(
                status_code=429, detail="The bot has reached its free daily limit. Please try again tomorrow."
            )
    system = build_system_prompt(db, payload.diet)
    try:
        reply = call_gemini(system, [m.model_dump() for m in payload.messages])
    except BotError as err:
        raise HTTPException(status_code=err.status_code, detail=err.message) from None
    return ChatOut(reply=reply)
