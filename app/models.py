from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timedelta
from .database import Base
import uuid


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class TouristID(Base):
    __tablename__ = "tourist_ids"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    temp_id = Column(String, index=True, unique=True, default=lambda: str(uuid.uuid4()))
    expires_at = Column(DateTime, default=lambda: datetime.utcnow() + timedelta(hours=24))
    created_at = Column(DateTime, default=datetime.utcnow)


class GeoFence(Base):
    __tablename__ = "geo_fences"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    fence_type = Column(String, default="safe")  # safe, restricted, high-risk
    geojson = Column(Text, nullable=False)  # store polygon GeoJSON
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Telemetry(Base):
    __tablename__ = "telemetry"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    speed = Column(Float, nullable=True)  # m/s or km/h depending on compute


class Incident(Base):
    __tablename__ = "incidents"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    description = Column(Text, nullable=True)
    status = Column(String, default="open")


class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=True)
    channel = Column(String, default="webhook")
    sent = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
