"""
Lunaris security utilities.
- JWT signing uses PyJWT (python-jose dropped due to CVEs).
- Passwords hashed with bcrypt (Argon2id upgrade path noted).
- UserSession table checked on every request → revocable tokens.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
import secrets as _secrets

import bcrypt
import jwt
from jwt.exceptions import InvalidTokenError

from fastapi import HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer

from app.core.config import settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


# ---------------------------------------------------------------------------
# Password hashing (bcrypt, rounds=12)
# ---------------------------------------------------------------------------

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        raw = plain_password.encode("utf-8")[:72]
        return bcrypt.checkpw(raw, hashed_password.encode("utf-8"))
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    raw = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(raw, salt).decode("utf-8")


# ---------------------------------------------------------------------------
# JWT helpers (PyJWT)
# ---------------------------------------------------------------------------

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


# ---------------------------------------------------------------------------
# Session management helpers
# ---------------------------------------------------------------------------

def create_user_session(user_id: str, ip_address: Optional[str], user_agent: Optional[str], db) -> str:
    """Persist a new UserSession row. Returns the raw token. Caller must commit."""
    from app.models import UserSession
    token = _secrets.token_urlsafe(64)
    session = UserSession(
        user_id=user_id,
        session_token=token,
        ip_address=ip_address,
        user_agent=user_agent,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    db.add(session)
    return token


def revoke_user_session(token: str, db) -> bool:
    """Mark a UserSession as revoked. Returns True if a live session was found."""
    from app.models import UserSession
    session = db.query(UserSession).filter(UserSession.session_token == token).first()
    if session and not session.is_revoked:
        session.is_revoked = True
        db.commit()
        return True
    return False


# ---------------------------------------------------------------------------
# FastAPI dependency: authenticated user (session-backed)
# ---------------------------------------------------------------------------

def _make_get_current_user(require_active: bool = True):
    from app.core.database import get_db
    from app.models import User, UserSession

    def dependency(
        token: Optional[str] = Depends(oauth2_scheme),
        db=Depends(get_db),
    ) -> "User":
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
                headers={"WWW-Authenticate": "Bearer"},
            )
        payload = decode_access_token(token)
        user_id: Optional[str] = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject")

        # Validate against UserSession table (revocation support)
        sid = payload.get("sid")
        session_query = db.query(UserSession).filter(UserSession.user_id == user_id)
        if sid:
            session_query = session_query.filter((UserSession.session_token == token) | (UserSession.session_token == sid))
        else:
            session_query = session_query.filter(UserSession.session_token == token)

        session = session_query.first()
        if session is not None:
            if session.is_revoked:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Session has been revoked. Please log in again.",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            exp = session.expires_at
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if exp < datetime.now(timezone.utc):
                session.is_revoked = True
                db.commit()
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Session expired. Please log in again.",
                )
        else:
            try:
                new_session = UserSession(
                    user_id=user_id,
                    session_token=token,
                    ip_address=None,
                    user_agent="token-auth",
                    expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
                    is_revoked=False,
                )
                db.add(new_session)
                db.commit()
            except Exception:
                db.rollback()

        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        if require_active and user.status != "active":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is not active")
        return user

    return dependency


get_current_user_dep = _make_get_current_user(require_active=True)

# Legacy alias used in existing routers — points to same dependency
get_current_user = get_current_user_dep

