from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import bearer_scheme, require_owner
from app.core.config import get_settings
from app.db.base import get_db
from app.services.bot import BotError, build_system_prompt, call_gemini
from app.services.diet import DIET_TAGS

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2000)


class ChatIn(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=20)
    diet: str | None = None


class ChatOut(BaseModel):
    reply: str


def chat_access(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
):
    """Owner-only by default, because the free Gemini quota is shared by everyone
    who can reach the bot. CHAT_PUBLIC=true opens it to visitors."""
    if get_settings().chat_public:
        return None
    return require_owner(credentials, db)


@router.get("/status")
def chat_status() -> dict:
    settings = get_settings()
    return {"configured": bool(settings.gemini_api_key), "public": settings.chat_public}


@router.post("", response_model=ChatOut)
def chat(payload: ChatIn, db: Session = Depends(get_db), _access=Depends(chat_access)) -> ChatOut:
    if payload.messages[-1].role != "user":
        raise HTTPException(status_code=422, detail="The last message must be from the user")
    if payload.diet is not None and payload.diet not in DIET_TAGS:
        raise HTTPException(status_code=422, detail=f"diet must be one of {DIET_TAGS}")
    system = build_system_prompt(db, payload.diet)
    try:
        reply = call_gemini(system, [m.model_dump() for m in payload.messages])
    except BotError as err:
        raise HTTPException(status_code=err.status_code, detail=err.message) from None
    return ChatOut(reply=reply)
