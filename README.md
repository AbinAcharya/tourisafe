# Tourisafe — Smart Tourist Safety System

A FastAPI-powered tourist safety platform with real-time geofencing, SOS alerts, a Leaflet admin dashboard, and a mobile-first tourist app with Google OAuth sign-in.

## Features

- **Google OAuth sign-in** — one-tap tourist onboarding (no new account to create)
- **One-tap SOS** — emergency button with haptic feedback + offline queue
- **Real-time geofencing** — alerts when tourists leave safe zones
- **Admin dashboard** — live Leaflet map with tourist locations and alert management
- **Tourist app** — mobile-first with emergency profile, GPS tracking, language selector
- **Telemetry history** — location ping log per tourist for admin review
- **Accessibility** — WCAG-aligned: 44px touch targets, ARIA labels, high-contrast mode, reduced-motion support, screen-reader text

## Quick Start

```bash
# 1. Create virtualenv and install
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 2. Set your SECRET_KEY (required)
export SECRET_KEY=$(python -c "import secrets; print(secrets.token_urlsafe(64))")

# 3. (Optional) Set up Google OAuth — see below
# export GOOGLE_CLIENT_ID=...
# export GOOGLE_CLIENT_SECRET=...

# 4. Seed demo users
python -m app.seed

# 5. Run the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- **Admin dashboard:** http://localhost:8000/
- **Tourist app:** http://localhost:8000/tourist
- **Login page:** http://localhost:8000/login

### Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@tourisafe.local | admin123 |
| Tourist | tourist@tourisafe.local | tourist123 |

## Google OAuth Setup

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Create an **OAuth 2.0 Client ID** (Web application)
3. Add `http://localhost:8000/auth/google/callback` to **Authorized redirect URIs**
4. Copy the **Client ID** and **Client Secret**
5. Set them as environment variables:

```bash
export GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
export GOOGLE_CLIENT_SECRET="your-client-secret"
```

Or add them to a `.env` file (do not commit this).

## Architecture

```
app/
├── main.py              # FastAPI entry point
├── database.py          # SQLAlchemy engine + session
├── models.py            # ORM models (User, TouristProfile, Geofence, SOSAlert, LocationPing)
├── auth.py              # JWT + Google OAuth + password hashing
├── alerts.py            # SOS notification stubs (SMS/push/webhook placeholders)
├── seed.py              # Dev seed script
├── routers/
│   ├── auth_routes.py   # /auth/* — login, register, Google OAuth callback
│   ├── tourist.py       # /api/tourist/* — SOS, location, profile
│   └── admin.py         # /api/admin/* — tourists, alerts, geofences, telemetry
└── templates/
    ├── index.html       # Admin dashboard (Leaflet map)
    ├── tourist.html     # Tourist app (SOS, map, profile, settings)
    └── auth.html        # Login/register page
```

## Security Notes

- **SECRET_KEY** is required and must come from an environment variable — the app refuses to start without it.
- Google OAuth credentials (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) are read from environment variables only.
- JWT tokens expire after 8 hours by default (configurable via `ACCESS_TOKEN_EXPIRE_MINUTES`).
- The `passlib[bcrypt]` library handles password hashing.
- For production: use PostgreSQL + PostGIS, add rate limiting, and review the `alerts.py` stubs.

## Accessibility Features

- **44×44px minimum touch targets** on all interactive elements
- **ARIA labels** on the SOS button, navigation tabs, form inputs, and alerts
- **`role="alert"` + `aria-live="assertive"`** on the SOS status (screen readers announce it)
- **High-contrast mode** support via `@media (prefers-contrast: high)`
- **Reduced motion** support via `@media (prefers-reduced-motion: reduce)`
- **Screen-reader-only** utility class (`.sr-only`)
- **Explicit `<label>` elements** on all form inputs
- **Language selector** with 8 languages (en, fr, es, de, ja, zh, hi, ar)
- **Battery-aware** location tracking (reports level, reduces polling when low)
- **Offline SOS queue** — queues alerts in localStorage when offline, flushes on reconnect

## Windows Users

Double-click `run.bat` or run from PowerShell:

```powershell
.\run.bat
```

Or use the PowerShell helper:

```powershell
.\start.ps1
```

## Production Notes

- This prototype uses SQLite. For production, switch to PostgreSQL + PostGIS.
- Notification sending in `app/alerts.py` is a placeholder — integrate SMS (Twilio), push (Firebase), or regional authority webhooks.
- Add rate limiting, CORS restrictions, and HTTPS in production.
- Replace `SECRET_KEY` with a strong value from your secrets manager.
