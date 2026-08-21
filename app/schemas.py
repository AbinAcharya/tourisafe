from pydantic import BaseModel
from typing import Optional, Any


class FenceCreate(BaseModel):
    name: str
    fence_type: str
    geojson: Any


class TelemetryIn(BaseModel):
    user_id: Optional[int] = None
    lat: float
    lon: float
    timestamp: Optional[str] = None


class SOSIn(BaseModel):
    user_id: Optional[int] = None
    lat: float
    lon: float
    description: Optional[str] = "SOS"
