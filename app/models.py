"""SQLAlchemy ORM models."""

from datetime import datetime, timedelta

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    """Auth user (admin or tourist)."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=True)
    google_sub = Column(String, unique=True, index=True, nullable=True)

    # Compatibility fields for the newer router-based auth flow.
    name = Column(String(255), nullable=True)
    hashed_password = Column(String(255), nullable=True)
    google_id = Column(String(255), unique=True, nullable=True)
    avatar_url = Column(String(512), nullable=True)
    phone = Column(String(50), nullable=True)

    is_admin = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    preferred_language = Column(String(10), default="en")
    created_at = Column(DateTime, default=datetime.utcnow)

    tourist_profile = relationship("TouristProfile", back_populates="user", uselist=False)


class TouristProfile(Base):
    """Extended tourist data linked to a User."""

    __tablename__ = "tourist_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    nationality = Column(String(100), nullable=True)
    emergency_contact_name = Column(String(255), nullable=True)
    emergency_contact_phone = Column(String(50), nullable=True)
    blood_type = Column(String(10), nullable=True)
    allergies = Column(Text, nullable=True)
    current_lat = Column(Float, nullable=True)
    current_lng = Column(Float, nullable=True)
    last_seen = Column(DateTime, default=datetime.utcnow)
    is_in_zone = Column(Boolean, default=True)

    user = relationship("User", back_populates="tourist_profile")


class GeoFence(Base):
    """Safe-zone polygon (stored as GeoJSON)."""

    __tablename__ = "geofences"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    fence_type = Column(String(50), default="restricted")
    geojson = Column(Text, nullable=False)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Telemetry(Base):
    __tablename__ = "telemetry"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    speed = Column(Float, default=0.0)


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(20), default="open")
    timestamp = Column(DateTime, default=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(String(255), nullable=False)
    entity_type = Column(String(100), nullable=False)
    entity_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class TouristID(Base):
    __tablename__ = "tourist_ids"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    temp_id = Column(String(64), unique=True, nullable=False, default=lambda: f"T-{datetime.utcnow().timestamp():.0f}")
    expires_at = Column(DateTime, default=lambda: datetime.utcnow() + timedelta(hours=12))
    created_at = Column(DateTime, default=datetime.utcnow)


class SOSAlert(Base):
    """Emergency SOS alert raised by a tourist."""

    __tablename__ = "sos_alerts"

    id = Column(Integer, primary_key=True, index=True)
    tourist_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    message = Column(Text, nullable=True)
    status = Column(String(20), default="active")
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    resolved_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    tourist = relationship("User", foreign_keys=[tourist_id])
    resolver = relationship("User", foreign_keys=[resolved_by])


class LocationPing(Base):
    """Location history for telemetry."""

    __tablename__ = "location_pings"

    id = Column(Integer, primary_key=True, index=True)
    tourist_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    accuracy = Column(Float, nullable=True)
    battery_level = Column(Integer, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    tourist = relationship("User", foreign_keys=[tourist_id])
