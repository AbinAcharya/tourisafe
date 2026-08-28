"""SQLAlchemy ORM models."""

from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Boolean,
    DateTime,
    Text,
    ForeignKey,
)
from sqlalchemy.orm import relationship
from app.database import Base


class User(Base):
    """Auth user (admin or tourist)."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=True)  # null for OAuth-only users
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


class Geofence(Base):
    """Safe-zone polygon (stored as GeoJSON)."""

    __tablename__ = "geofences"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    geojson = Column(Text, nullable=False)  # GeoJSON Polygon
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)


class SOSAlert(Base):
    """Emergency SOS alert raised by a tourist."""

    __tablename__ = "sos_alerts"

    id = Column(Integer, primary_key=True, index=True)
    tourist_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    message = Column(Text, nullable=True)
    status = Column(String(20), default="active")  # active, acknowledged, resolved
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
