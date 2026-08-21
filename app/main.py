from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.responses import JSONResponse, FileResponse, RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from . import models, auth, fencing, telemetry as telemetry_utils, alerts
from .database import engine, Base, get_db
from . import schemas
import json
from datetime import datetime
from .ws import manager
from fastapi import WebSocket

Base.metadata.create_all(bind=engine)

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


@app.post("/register")
def register(username: str, email: str, password: str, db: Session = Depends(get_db)):
    try:
        # debug log
        with open('debug.log','a') as _f: _f.write(f"register attempt: {username} {email}\n")
        existing = db.query(models.User).filter((models.User.username == username) | (models.User.email == email)).first()
        if existing:
            raise HTTPException(status_code=400, detail="Username or email already registered")
        ph = auth.get_password_hash(password)
        with open('debug.log','a') as _f: _f.write(f"password hash ok, len={len(ph)}\n")
        user = models.User(username=username, email=email, password_hash=ph)
        db.add(user)
        db.commit()
        db.refresh(user)
        with open('debug.log','a') as _f: _f.write(f"user created id={user.id}\n")
        return {"id": user.id, "username": user.username}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Registration error: {e}")


@app.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    token = auth.create_access_token({"sub": user.username}, expires_delta=timedelta(hours=12))
    return {"access_token": token, "token_type": "bearer"}


@app.post("/generate_tourist_id")
def generate_tourist_id(user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    t = models.TouristID(user_id=user.id)
    db.add(t)
    db.commit()
    db.refresh(t)
    return {"temp_id": t.temp_id, "expires_at": t.expires_at.isoformat()}


@app.post("/fences")
def create_fence(fence: schemas.FenceCreate, user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin required")
    geojson_text = json.dumps(fence.geojson)
    f = models.GeoFence(name=fence.name, fence_type=fence.fence_type, geojson=geojson_text)
    db.add(f)
    db.commit()
    db.refresh(f)
    return {"id": f.id}


@app.get("/api/fences")
def list_fences(db: Session = Depends(get_db)):
    fences = db.query(models.GeoFence).filter(models.GeoFence.active == True).all()
    return [{"id": f.id, "name": f.name, "fence_type": f.fence_type, "geojson": json.loads(f.geojson)} for f in fences]


@app.get("/check_point")
def check_point(lat: float, lon: float, db: Session = Depends(get_db)):
    fences = db.query(models.GeoFence).filter(models.GeoFence.active == True).all()
    inside = []
    for f in fences:
        if fencing.point_in_geojson(f.geojson, lat, lon):
            inside.append({"id": f.id, "name": f.name, "fence_type": f.fence_type})
    return {"inside": inside}


@app.post("/telemetry")
def ingest_telemetry(payload: schemas.TelemetryIn, db: Session = Depends(get_db)):
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
        if fencing.point_in_geojson(f.geojson, lat, lon) and f.fence_type == "restricted":
            flags.append({"fence": f.name, "type": f.fence_type})
    anomaly = None
    if t.speed and t.speed > 50:  # >50 m/s ~ unrealistic
        anomaly = "excessive_speed"
    return {"telemetry_id": t.id, "speed": t.speed, "flags": flags, "anomaly": anomaly}


@app.post("/sos")
def sos(payload: schemas.SOSIn, db: Session = Depends(get_db)):
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
