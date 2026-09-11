"""Admin API: geofences, alerts, tourist overview, telemetry."""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    Geofence,
    SOSAlert,
    TouristProfile,
    User,
    LocationPing,
)
from app.auth import require_admin

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ---------- Schemas ----------

class GeofenceCreate(BaseModel):
    name: str
    description: Optional[str] = None
    geojson: str  # GeoJSON Polygon string


class AlertResolve(BaseModel):
    status: str  # acknowledged | resolved


# ---------- Dashboard ----------

@router.get("/tourists")
async def list_tourists(
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Return all tourist profiles with their latest location."""
    profiles = db.query(TouristProfile).all()
    result = []
    for p in profiles:
        u = db.query(User).filter(User.id == p.user_id).first()
        result.append(
            {
                "user_id": p.user_id,
                "name": u.name if u else "Unknown",
                "email": u.email if u else "",
                "lat": p.current_lat,
                "lng": p.current_lng,
                "is_in_zone": p.is_in_zone,
                "last_seen": p.last_seen.isoformat() if p.last_seen else None,
            }
        )
    return result


# ---------- Alerts ----------

@router.get("/alerts")
async def list_alerts(
    status_filter: Optional[str] = None,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    q = db.query(SOSAlert).order_by(SOSAlert.created_at.desc())
    if status_filter:
        q = q.filter(SOSAlert.status == status_filter)
    alerts = q.limit(50).all()

    result = []
    for a in alerts:
        tourist = db.query(User).filter(User.id == a.tourist_id).first()
        result.append(
            {
                "id": a.id,
                "tourist_name": tourist.name if tourist else "Unknown",
                "tourist_email": tourist.email if tourist else "",
                "lat": a.lat,
                "lng": a.lng,
                "message": a.message,
                "status": a.status,
                "created_at": a.created_at.isoformat(),
                "resolved_at": a.resolved_at.isoformat() if a.resolved_at else None,
            }
        )
    return result


@router.patch("/alerts/{alert_id}")
async def update_alert(
    alert_id: int,
    data: AlertResolve,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    alert = db.query(SOSAlert).filter(SOSAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.status = data.status
    if data.status == "resolved":
        alert.resolved_at = datetime.utcnow()
        alert.resolved_by = user.id
    db.commit()
    return {"status": "updated"}


# ---------- Geofences ----------

@router.get("/geofences")
async def list_geofences(
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    fences = db.query(Geofence).all()
    return [
        {
            "id": f.id,
            "name": f.name,
            "description": f.description,
            "geojson": f.geojson,
            "is_active": f.is_active,
            "created_at": f.created_at.isoformat(),
        }
        for f in fences
    ]


@router.post("/geofences")
async def create_geofence(
    data: GeofenceCreate,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    import json
    try:
        json.loads(data.geojson)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid GeoJSON")

    gf = Geofence(
        name=data.name,
        description=data.description,
        geojson=data.geojson,
        created_by=user.id,
    )
    db.add(gf)
    db.commit()
    db.refresh(gf)
    return {"id": gf.id, "status": "created"}


@router.delete("/geofences/{fence_id}")
async def delete_geofence(
    fence_id: int,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    gf = db.query(Geofence).filter(Geofence.id == fence_id).first()
    if not gf:
        raise HTTPException(status_code=404, detail="Geofence not found")
    db.delete(gf)
    db.commit()
    return {"status": "deleted"}


# ---------- Telemetry history ----------

@router.get("/telemetry/{tourist_id}")
async def telemetry_history(
    tourist_id: int,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Location ping history for a specific tourist."""
    pings = (
        db.query(LocationPing)
        .filter(LocationPing.tourist_id == tourist_id)
        .order_by(LocationPing.timestamp.desc())
        .limit(200)
        .all()
    )
    return [
        {
            "lat": p.lat,
            "lng": p.lng,
            "accuracy": p.accuracy,
            "battery_level": p.battery_level,
            "timestamp": p.timestamp.isoformat(),
        }
        for p in pings
    ]
