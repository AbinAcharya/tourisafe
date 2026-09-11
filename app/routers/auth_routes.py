"""Auth routes: email/password login, registration, Google OAuth."""

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.auth import (
    hash_password,
    verify_password,
    create_access_token,
    google_auth_url,
    exchange_google_code,
    find_or_create_google_user,
    get_current_user,
)

router = APIRouter(prefix="/auth", tags=["auth"])


# ---------- Schemas ----------

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str


class LoginRequest(BaseModel):
    email: str
    password: str


# ---------- Email / Password ----------

@router.post("/register")
async def register(req: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=req.email,
        name=req.name,
        hashed_password=hash_password(req.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": user.id, "email": user.email, "name": user.name})
    return {"access_token": token, "token_type": "bearer", "user": {"id": user.id, "name": user.name, "email": user.email}}


@router.post("/login")
async def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not user.hashed_password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": user.id, "email": user.email, "name": user.name})
    return {"access_token": token, "token_type": "bearer", "user": {"id": user.id, "name": user.name, "email": user.email, "is_admin": user.is_admin}}


# ---------- Google OAuth ----------

@router.get("/google/login")
async def google_login():
    """Redirect to Google's consent screen."""
    url = google_auth_url(state="tourisafe")
    return RedirectResponse(url=url)


@router.get("/google/callback")
async def google_callback(code: str = "", state: str = "", db: Session = Depends(get_db)):
    """Handle the Google OAuth callback."""
    if not code:
        raise HTTPException(status_code=400, detail="Missing authorization code")

    try:
        google_info = await exchange_google_code(code)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Google OAuth exchange failed: {e}")

    user = find_or_create_google_user(db, google_info)
    token = create_access_token({"sub": user.id, "email": user.email, "name": user.name})

    # Redirect to the tourist app with the token
    return RedirectResponse(url=f"/tourist?token={token}")


# ---------- Current user ----------

@router.get("/me")
async def me(user: User = Depends(get_current_user)):
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "avatar_url": user.avatar_url,
        "is_admin": user.is_admin,
        "preferred_language": user.preferred_language,
    }
