from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.responses import JSONResponse, FileResponse, RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from . import models, auth, fencing, telemetry as telemetry_utils, alerts
from .database import engine, Base, get_db, ensure_schema
from . import schemas
import os
import json
import uuid
from datetime import datetime
from .ws import manager
from fastapi import WebSocket

Base.metadata.create_all(bind=engine)
# Apply non-destructive column migrations for databases created before newer columns existed.
ensure_schema()

# Google Sign-In client id (empty disables the feature; the frontend hides the button).
GOOGLE_CLIENT_ID = os.environ.get("TOURISAFE_GOOGLE_CLIENT_ID", "")

# NOTE: removed automatic creation of a default admin user to allow manual admin setup
# Use the script scripts/create_admin.py to create an admin account when needed.

app = FastAPI(title="Tourisafe - Smart Tourist Safety System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static"), name="static")


def record_audit(db: Session, user: models.User, action: str, entity_type: str, entity_id: int | None = None):
    db.add(models.AuditLog(user_id=user.id, action=action, entity_type=entity_type, entity_id=entity_id))


@app.post("/register")
def register(payload: schemas.RegisterIn, db: Session = Depends(get_db)):
    try:
        existing = db.query(models.User).filter((models.User.username == payload.username) | (models.User.email == payload.email)).first()
        if existing:
            raise HTTPException(status_code=400, detail="Username or email already registered")
        ph = auth.get_password_hash(payload.password)
        user = models.User(username=payload.username, email=payload.email, password_hash=ph)
        db.add(user)
        db.commit()
        db.refresh(user)
        return {"id": user.id, "username": user.username}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Registration error: {e}")


@app.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not user.password_hash:
        raise HTTPException(status_code=400, detail="Incorrect username or password")

    ok = auth.verify_password(form_data.password, user.password_hash)
    # One-time migration: legacy accounts stored the password as plaintext (the old
    # bcrypt path silently failed). If the stored value isn't a recognised hash and it
    # matches, accept the login and transparently upgrade it to a proper pbkdf2 hash.
    if not ok and not auth.is_hashed(user.password_hash) and form_data.password == user.password_hash:
        ok = True
    if not ok:
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    if not auth.is_hashed(user.password_hash):
        user.password_hash = auth.get_password_hash(form_data.password)
        db.commit()

    token = auth.create_access_token({"sub": user.username}, expires_delta=timedelta(hours=12))
    return {"access_token": token, "token_type": "bearer", "user_id": user.id}


@app.get("/api/config")
def public_config():
    """Client-readable configuration. Empty client id keeps the Google button hidden."""
    return {"google_client_id": GOOGLE_CLIENT_ID}


def _unique_username(db: Session, base: str) -> str:
    base = "".join(ch for ch in (base or "user") if ch.isalnum() or ch in ("_", "-", ".")) or "user"
    candidate = base
    n = 0
    while db.query(models.User).filter(models.User.username == candidate).first():
        n += 1
        candidate = f"{base}{n}"
    return candidate


@app.post("/auth/google")
def auth_google(payload: schemas.GoogleAuthIn, db: Session = Depends(get_db)):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google Sign-In is not configured")
    try:
        from google.oauth2 import id_token as google_id_token
        from google.auth.transport import requests as google_requests
        info = google_id_token.verify_oauth2_token(payload.credential, google_requests.Request(), GOOGLE_CLIENT_ID)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid Google credential")

    if info.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise HTTPException(status_code=401, detail="Invalid token issuer")
    if not info.get("email_verified"):
        raise HTTPException(status_code=401, detail="Google email not verified")

    sub = info.get("sub")
    email = info.get("email")
    if not sub or not email:
        raise HTTPException(status_code=401, detail="Google token missing required claims")

    # Find by Google subject first, then link an existing account by email.
    user = db.query(models.User).filter(models.User.google_sub == sub).first()
    if not user:
        user = db.query(models.User).filter(models.User.email == email).first()
        if user:
            user.google_sub = sub
        else:
            user = models.User(
                username=_unique_username(db, email.split("@")[0]),
                email=email,
                google_sub=sub,
                # Unusable sentinel: satisfies the still-NOT-NULL column on existing DBs
                # and can never match a login attempt (it is not a valid hash).
                password_hash=uuid.uuid4().hex,
            )
            db.add(user)
        db.commit()
        db.refresh(user)

    token = auth.create_access_token({"sub": user.username}, expires_delta=timedelta(hours=12))
    return {"access_token": token, "token_type": "bearer", "user_id": user.id}


@app.post("/generate_tourist_id")
def generate_tourist_id(user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    t = models.TouristID(user_id=user.id)
    db.add(t)
    db.commit()
    db.refresh(t)
    return {"temp_id": t.temp_id, "expires_at": t.expires_at.isoformat()}


@app.post("/fences")
async def create_fence(fence: schemas.FenceCreate, user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin required")
    geojson_text = json.dumps(fence.geojson)
    f = models.GeoFence(name=fence.name, fence_type=fence.fence_type, geojson=geojson_text)
    db.add(f)
    db.commit()
    db.refresh(f)
    # broadcast new fence to connected clients so UIs can update live
    try:
        import asyncio
        asyncio.create_task(manager.broadcast({"type": "fence_created", "id": f.id, "name": f.name, "fence_type": f.fence_type, "geojson": json.loads(f.geojson)}))
    except Exception:
        pass
    return {"id": f.id}


@app.get("/api/fences")
def list_fences(db: Session = Depends(get_db)):
    fences = db.query(models.GeoFence).filter(models.GeoFence.active == True).all()
    return [{"id": f.id, "name": f.name, "fence_type": f.fence_type, "geojson": json.loads(f.geojson)} for f in fences]


@app.delete("/admin/fences")
async def delete_all_fences(user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin required")
    fences = db.query(models.GeoFence).filter(models.GeoFence.active == True).all()
    fence_ids = [f.id for f in fences]
    for fence in fences:
        record_audit(db, user, "delete", "fence", fence.id)
        db.delete(fence)
    deleted = len(fences)
    db.commit()
    await manager.broadcast({"type": "fences_deleted", "ids": fence_ids})
    return {"deleted": deleted}


@app.delete("/admin/fences/{fence_id}")
async def delete_fence(fence_id: int, user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin required")
    fence = db.query(models.GeoFence).filter(models.GeoFence.id == fence_id).first()
    if not fence:
        raise HTTPException(status_code=404, detail="Fence not found")
    db.delete(fence)
    record_audit(db, user, "delete", "fence", fence_id)
    db.commit()
    await manager.broadcast({"type": "fence_deleted", "id": fence_id})
    return {"deleted": fence_id}


@app.get("/check_point")
def check_point(lat: float, lon: float, db: Session = Depends(get_db)):
    fences = db.query(models.GeoFence).filter(models.GeoFence.active == True).all()
    inside = []
    for f in fences:
        if fencing.point_in_geojson(f.geojson, lat, lon):
            inside.append({"id": f.id, "name": f.name, "fence_type": f.fence_type})
    return {"inside": inside}


@app.post("/telemetry")
async def ingest_telemetry(payload: schemas.TelemetryIn, db: Session = Depends(get_db)):
    ts = None
    if payload.timestamp:
        try:
            ts = datetime.fromisoformat(payload.timestamp)
        except Exception:
            ts = datetime.utcnow()
    else:
        ts = datetime.utcnow()
    try:
        t = models.Telemetry(user_id=payload.user_id, lat=payload.lat, lon=payload.lon, timestamp=ts)
        # compute speed from last point
        prev = None
        if payload.user_id is not None:
            prev = db.query(models.Telemetry).filter(models.Telemetry.user_id == payload.user_id).order_by(models.Telemetry.timestamp.desc()).first()
        if prev:
            speed = telemetry_utils.compute_speed_m_s((prev.lat, prev.lon), prev.timestamp, (payload.lat, payload.lon), ts)
            t.speed = speed
        db.add(t)
        db.commit()
        db.refresh(t)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Telemetry ingest error: {e}")

    # broadcast the latest tourist location so the admin map stays live
    try:
        import asyncio
        asyncio.create_task(manager.broadcast({"type": "telemetry_update", "user_id": t.user_id, "lat": t.lat, "lon": t.lon, "timestamp": t.timestamp.isoformat(), "speed": t.speed}))
    except Exception:
        pass
    
    # broadcast telemetry event if anomaly or simply to update map
    if t.speed and t.speed > 20:  # threshold m/s ~72 km/h
        try:
            import asyncio
            asyncio.create_task(manager.broadcast({"type": "telemetry_anomaly", "user_id": t.user_id, "lat": t.lat, "lon": t.lon, "speed": t.speed}))
        except Exception:
            pass
    # optionally check geo-fences and flag anomalies (very basic)
    fences = db.query(models.GeoFence).filter(models.GeoFence.active == True).all()
    flags = []
    for f in fences:
        if fencing.point_in_geojson(f.geojson, t.lat, t.lon):
            if f.fence_type == "restricted":
                flags.append({"fence": f.name, "type": f.fence_type})
            # notify when entering restricted or high-risk fences
            if f.fence_type in {"restricted", "high-risk"}:
                flags.append({"fence": f.name, "type": f.fence_type})
                try:
                    import asyncio
                    asyncio.create_task(manager.broadcast({"type": "fence_alert", "user_id": t.user_id, "fence": f.name, "fence_type": f.fence_type, "lat": t.lat, "lon": t.lon}))
                except Exception:
                    pass
    anomaly = None
    if t.speed and t.speed > 50:  # >50 m/s ~ unrealistic
        anomaly = "excessive_speed"
    return {"telemetry_id": t.id, "speed": t.speed, "flags": flags, "anomaly": anomaly}


@app.post("/sos")
async def sos(payload: schemas.SOSIn, db: Session = Depends(get_db)):
    try:
        inc = models.Incident(user_id=payload.user_id, lat=payload.lat, lon=payload.lon, description=payload.description)
        db.add(inc)
        db.commit()
        db.refresh(inc)
        # create notification
        alerts.notify_authorities(inc.id)
        # broadcast incident via websocket
        try:
            import asyncio
            asyncio.create_task(manager.broadcast({"type": "incident_created", "id": inc.id, "lat": inc.lat, "lon": inc.lon, "description": inc.description}))
        except Exception:
            pass
        return {"incident_id": inc.id, "status": inc.status}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SOS error: {e}")


@app.get("/api/incidents")
def get_incidents(db: Session = Depends(get_db)):
    incidents = db.query(models.Incident).order_by(models.Incident.timestamp.desc()).limit(200).all()
    return [{"id": i.id, "lat": i.lat, "lon": i.lon, "desc": i.description, "status": i.status, "ts": i.timestamp.isoformat()} for i in incidents]


@app.patch("/admin/incidents/{incident_id}")
def update_incident(incident_id: int, payload: dict, user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin required")
    incident = db.query(models.Incident).filter(models.Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    status_value = payload.get("status")
    if status_value not in {"open", "acknowledged", "resolved"}:
        raise HTTPException(status_code=400, detail="Invalid incident status")
    incident.status = status_value
    record_audit(db, user, f"status:{status_value}", "incident", incident_id)
    db.commit()
    return {"id": incident.id, "status": incident.status}


@app.delete("/admin/incidents")
def clear_incidents(user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin required")
    deleted = db.query(models.Incident).delete(synchronize_session=False)
    record_audit(db, user, "clear", "incidents", deleted)
    db.commit()
    return {"deleted": deleted}


@app.get("/admin/me")
def admin_me(user: models.User = Depends(auth.get_current_user)):
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin required")
    return {"id": user.id, "username": user.username, "email": user.email, "is_admin": user.is_admin}


@app.get("/admin/audit")
def get_audit(user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin required")
    logs = db.query(models.AuditLog).order_by(models.AuditLog.created_at.desc()).limit(100).all()
    return [{"id": log.id, "action": log.action, "entity_type": log.entity_type, "entity_id": log.entity_id, "created_at": log.created_at.isoformat()} for log in logs]


@app.post('/admin/register')
def admin_register(payload: schemas.AdminRegister, user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    if not user.is_admin:
        raise HTTPException(status_code=403, detail='Admin required')
    existing = db.query(models.User).filter((models.User.username == payload.username) | (models.User.email == payload.email)).first()
    if existing:
        raise HTTPException(status_code=400, detail='Username or email already exists')
    ph = auth.get_password_hash(payload.password)
    u = models.User(username=payload.username, email=payload.email, password_hash=ph, is_admin=True)
    db.add(u)
    db.commit()
    db.refresh(u)
    return {'id': u.id, 'username': u.username}


@app.post('/admin/reset_password')
def admin_reset_password(payload: schemas.AdminReset, user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    if not user.is_admin:
        raise HTTPException(status_code=403, detail='Admin required')
    target = db.query(models.User).filter(models.User.username == payload.username).first()
    if not target:
        raise HTTPException(status_code=404, detail='User not found')
    target.password_hash = auth.get_password_hash(payload.new_password)
    db.add(target)
    db.commit()
    return {'status': 'ok'}


@app.post('/admin/change_password')
def admin_change_password(payload: schemas.ChangePassword, user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    if not auth.verify_password(payload.old_password, user.password_hash):
        raise HTTPException(status_code=400, detail='Incorrect old password')
    user.password_hash = auth.get_password_hash(payload.new_password)
    db.add(user)
    db.commit()
    return {'status': 'ok'}


@app.get("/")
def index():
    return RedirectResponse(url="/static/index.html")


# The service worker and manifest have to be served from the site ROOT: a worker
# under /static/ may only control /static/*, and a manifest's scope cannot point
# above its own directory. Both files still live in static/.
@app.get("/sw.js")
def service_worker():
    return FileResponse(
        "static/sw.js",
        media_type="application/javascript",
        headers={"Service-Worker-Allowed": "/", "Cache-Control": "no-cache"},
    )


@app.get("/manifest.webmanifest")
def web_manifest():
    return FileResponse("static/manifest.webmanifest", media_type="application/manifest+json")


@app.get("/tourist")
def tourist_page():
    return RedirectResponse(url="/static/tourist.html")


@app.get("/admin")
def admin_page():
    return RedirectResponse(url="/static/index.html")


@app.websocket('/ws')
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except Exception:
        manager.disconnect(websocket)
