"""Authentication: JWT sessions, password hashing, Google OAuth."""

import os
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User

# Read the signing secret from the environment. The default preserves any tokens
# already issued in development; production MUST set TOURISAFE_SECRET_KEY.
SECRET_KEY = os.environ.get("TOURISAFE_SECRET_KEY", "change-this-secret-in-prod")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

# pbkdf2_sha256 is pure-stdlib (hashlib), avoids bcrypt/passlib incompatibility,
# and works reliably across platforms.
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")

# Google OAuth credentials
GOOGLE_CLIENT_ID = os.getenv("TOURISAFE_GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("TOURISAFE_GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv("TOURISAFE_GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/google/callback")


def is_hashed(stored: str) -> bool:
    """True when the stored value is a recognised passlib hash (not legacy plaintext)."""
    try:
        return pwd_context.identify(stored) is not None
    except Exception:
        return False


def verify_password(plain_password, hashed_password):
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False


def get_password_hash(password):
    return pwd_context.hash(password)


def hash_password(password: str) -> str:
    return get_password_hash(password)


def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    if "sub" in to_encode and not isinstance(to_encode["sub"], str):
        to_encode["sub"] = str(to_encode["sub"])
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> dict:
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    return payload


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if token is None:
        raise credentials_exception
    try:
        payload = decode_token(token)
        sub = payload.get("sub")
        if sub is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = None
    if isinstance(sub, str):
        user = db.query(User).filter(User.username == sub).first()
        if user is None:
            try:
                user = db.query(User).filter(User.id == int(sub)).first()
            except (TypeError, ValueError):
                user = None
    else:
        user = db.query(User).filter(User.id == sub).first()

    if user is None or (hasattr(user, "is_active") and not user.is_active):
        raise credentials_exception
    return user


async def require_admin(user: User = Depends(get_current_user)) -> User:
    if not getattr(user, "is_admin", False):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


def google_auth_url(state: str = "tourisafe") -> str:
    """Build the Google OAuth2 consent-screen URL."""
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google OAuth not configured (set GOOGLE_CLIENT_ID)")
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "state": state,
    }
    qs = "&".join(f"{k}={v}" for k, v in params.items())
    return f"https://accounts.google.com/o/oauth2/v2/auth?{qs}"


async def exchange_google_code(code: str) -> dict:
    """Exchange an authorization code for Google user info."""
    import httpx

    token_url = "https://oauth2.googleapis.com/token"
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            token_url,
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
        token_resp.raise_for_status()
        tokens = token_resp.json()

        userinfo_resp = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        userinfo_resp.raise_for_status()
        return userinfo_resp.json()


def find_or_create_google_user(db: Session, google_info: dict) -> User:
    """Find existing user by Google ID or email, or create a new one."""
    google_id = google_info["sub"]
    email = google_info.get("email", "")
    name = google_info.get("name", email.split("@")[0])
    avatar = google_info.get("picture", "")

    user = db.query(User).filter(User.google_id == google_id).first()
    if user:
        user.avatar_url = avatar
        db.commit()
        db.refresh(user)
        return user

    user = db.query(User).filter(User.email == email).first()
    if user:
        user.google_id = google_id
        user.avatar_url = avatar
        db.commit()
        db.refresh(user)
        return user

    user = User(
        email=email,
        name=name,
        username=name,
        google_id=google_id,
        google_sub=google_id,
        avatar_url=avatar,
        is_admin=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
