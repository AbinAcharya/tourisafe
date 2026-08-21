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


class AdminRegister(BaseModel):
    username: str
    email: str
    password: str


class AdminReset(BaseModel):
    username: str
    new_password: str


class ChangePassword(BaseModel):
    old_password: str
    new_password: str
