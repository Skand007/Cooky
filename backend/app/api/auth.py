from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_owner
from app.core.security import create_access_token, verify_password
from app.db.base import get_db
from app.models.owner import Owner
from app.schemas.auth import LoginRequest, MeResponse, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    owner = db.query(Owner).filter(Owner.username == payload.username).first()
    if owner is None or not verify_password(payload.password, owner.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Wrong username or password")

    token = create_access_token(subject=owner.username)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=MeResponse)
def me(owner: Owner = Depends(require_owner)) -> MeResponse:
    return MeResponse(username=owner.username)
