"""Tourisafe — Smart Tourist Safety System.

Entry point: run with ``uvicorn app.main:app --reload --host 0.0.0.0 --port 8000``
"""

import os
import secrets

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.routers import tourist, admin, auth_routes

# ---------------------------------------------------------------------------
# Create tables on startup (prototype — use Alembic in production)
# ---------------------------------------------------------------------------
Base.metadata.create_all(bind=engine)

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Tourisafe",
    description="Smart Tourist Safety System",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(auth_routes.router)
app.include_router(tourist.router)
app.include_router(admin.router)

# ---------------------------------------------------------------------------
# Static files (if a static/ directory exists)
# ---------------------------------------------------------------------------
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

# ---------------------------------------------------------------------------
# HTML page routes
# ---------------------------------------------------------------------------
TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "templates")


def _read_template(name: str) -> str:
    path = os.path.join(TEMPLATES_DIR, name)
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


@app.get("/", response_class=HTMLResponse)
async def admin_dashboard():
    """Admin dashboard (Leaflet map + tourist overview)."""
    return HTMLResponse(content=_read_template("index.html"))


@app.get("/login", response_class=HTMLResponse)
async def login_page():
    """Auth page with Google OAuth + email/password."""
    return HTMLResponse(content=_read_template("auth.html"))


@app.get("/tourist", response_class=HTMLResponse)
async def tourist_page():
    """Tourist-facing mobile page (SOS, map, profile)."""
    return HTMLResponse(content=_read_template("tourist.html"))


@app.get("/health")
async def health():
    return {"status": "ok", "app": "tourisafe"}
