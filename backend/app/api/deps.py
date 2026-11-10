"""Shared FastAPI dependencies: DB session + owner-only auth guard."""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.base import get_db
from app.models.owner import Owner

bearer_scheme = HTTPBearer(auto_error=False)


def require_owner(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Owner:
    """Raises 401 unless the request carries a valid owner access token.

    Every write endpoint in Cooky depends on this — reads stay public,
    writes are Skand-only.
    """
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    username = decode_access_token(credentials.credentials)
    if username is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    owner = db.query(Owner).filter(Owner.username == username).first()
    if owner is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Owner not found")

    return owner
