"""Tourist-facing API: SOS, location, profile."""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import SOSAlert, TouristProfile, LocationPing, User, Geofence
from app.auth import get_current_user
from app.alerts import notify_emergency_services, notify_emergency_contact, notify_admins

router = APIRouter(prefix="/api/tourist", tags=["tourist"])


# ---------- Schemas ----------

class SOSRequest(BaseModel):
    message: Optional[str] = "SOS"


class LocationUpdate(BaseModel):
    lat: float
    lng: float
    accuracy: Optional[float] = None
    battery_level: Optional[int] = None


class ProfileUpdate(BaseModel):
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    blood_type: Optional[str] = None
    allergies: Optional[str] = None
    nationality: Optional[str] = None
    preferred_language: Optional[str] = "en"


# ---------- SOS ----------

@router.post("/sos")
async def trigger_sos(
    req: SOSRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Trigger an SOS alert with the tourist's last known location."""
    profile = db.query(TouristProfile).filter(TouristProfile.user_id == user.id).first()
    lat = profile.current_lat if profile else None
    lng = profile.current_lng if profile else None

    alert = SOSAlert(
        tourist_id=user.id,
        lat=lat,
        lng=lng,
        message=req.message,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)

    # Fire notifications in parallel (fire-and-forget for speed)
    await notify_emergency_services(alert, db)
    await notify_emergency_contact(alert, db)
    await notify_admins(alert, db)

    return {
        "status": "active",
        "alert_id": alert.id,
        "message": "SOS alert sent. Help is on the way.",
    }


# ---------- Location ----------

@router.post("/location")
async def update_location(
    loc: LocationUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the tourist's current GPS position."""
    profile = db.query(TouristProfile).filter(TouristProfile.user_id == user.id).first()
    if not profile:
        profile = TouristProfile(user_id=user.id)
        db.add(profile)

    profile.current_lat = loc.lat
    profile.current_lng = loc.lng
    profile.last_seen = datetime.utcnow()

    # Log history
    ping = LocationPing(
        tourist_id=user.id,
        lat=loc.lat,
        lng=loc.lng,
        accuracy=loc.accuracy,
        battery_level=loc.battery_level,
    )
    db.add(ping)
    db.commit()

    # Check geofences
    in_zone = _check_geofences(loc.lat, loc.lng, db)
    profile.is_in_zone = in_zone
    db.commit()

    return {"status": "ok", "in_safe_zone": in_zone}


@router.get("/location/history")
async def location_history(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return location ping history for the current tourist."""
    pings = (
        db.query(LocationPing)
        .filter(LocationPing.tourist_id == user.id)
        .order_by(LocationPing.timestamp.desc())
        .limit(100)
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


# ---------- Profile ----------

@router.get("/profile")
async def get_profile(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.query(TouristProfile).filter(TouristProfile.user_id == user.id).first()
    if not profile:
        return {}
    return {
        "nationality": profile.nationality,
        "emergency_contact_name": profile.emergency_contact_name,
        "emergency_contact_phone": profile.emergency_contact_phone,
        "blood_type": profile.blood_type,
        "allergies": profile.allergies,
        "preferred_language": user.preferred_language,
    }


@router.put("/profile")
async def update_profile(
    data: ProfileUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.query(TouristProfile).filter(TouristProfile.user_id == user.id).first()
    if not profile:
        profile = TouristProfile(user_id=user.id)
        db.add(profile)

    for field, value in data.dict(exclude_unset=True).items():
        if field == "preferred_language":
            user.preferred_language = value
        else:
            setattr(profile, field, value)

    db.commit()
    return {"status": "updated"}


# ---------- Helpers ----------

def _check_geofences(lat: float, lng: float, db: Session) -> bool:
    """Check if a point is inside any active geofence."""
    from shapely.geometry import shape, Point

    geofences = db.query(Geofence).filter(Geofence.is_active == True).all()
    if not geofences:
        return True  # no fences = safe

    point = Point(lng, lat)
    for gf in geofences:
        try:
            import json
            zone = shape(json.loads(gf.geojson))
            if zone.contains(point):
                return True
        except Exception:
            continue
    return False
