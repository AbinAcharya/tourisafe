"""Tests for tourist API: SOS, location, profile, geofencing."""

import json
import pytest

from app.models import User, TouristProfile, SOSAlert, LocationPing, Geofence
from tests.conftest import create_tourist, auth_header


class TestSOS:
    def test_trigger_sos(self, client, db):
        user = create_tourist(db)
        token_resp = client.post("/auth/login", json={"email": "tourist@test.com", "password": "tourist123"})
        token = token_resp.json()["access_token"]

        resp = client.post("/api/tourist/sos", json={"message": "Help me!"}, headers=auth_header(token))
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "active"
        assert data["alert_id"] is not None
        assert "Help is on the way" in data["message"]

    def test_sos_includes_location(self, client, db):
        user = create_tourist(db)
        # Set a profile with location
        profile = TouristProfile(user_id=user.id, current_lat=48.85, current_lng=2.35)
        db.add(profile)
        db.commit()

        token_resp = client.post("/auth/login", json={"email": "tourist@test.com", "password": "tourist123"})
        token = token_resp.json()["access_token"]

        resp = client.post("/api/tourist/sos", json={}, headers=auth_header(token))
        assert resp.status_code == 200
        alert = db.query(SOSAlert).filter(SOSAlert.tourist_id == user.id).first()
        assert alert.lat == 48.85
        assert alert.lng == 2.35

    def test_sos_no_auth(self, client):
        resp = client.post("/api/tourist/sos", json={})
        assert resp.status_code == 401

    def test_sos_default_message(self, client, db):
        create_tourist(db)
        token_resp = client.post("/auth/login", json={"email": "tourist@test.com", "password": "tourist123"})
        token = token_resp.json()["access_token"]

        resp = client.post("/api/tourist/sos", json={}, headers=auth_header(token))
        assert resp.status_code == 200
        alert = db.query(SOSAlert).first()
        assert alert.message == "SOS"


class TestLocation:
    def test_update_location(self, client, db):
        create_tourist(db)
        token_resp = client.post("/auth/login", json={"email": "tourist@test.com", "password": "tourist123"})
        token = token_resp.json()["access_token"]

        resp = client.post("/api/tourist/location", json={
            "lat": 48.8566, "lng": 2.3522, "accuracy": 10, "battery_level": 85
        }, headers=auth_header(token))
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

    def test_location_creates_profile(self, client, db):
        create_tourist(db)
        token_resp = client.post("/auth/login", json={"email": "tourist@test.com", "password": "tourist123"})
        token = token_resp.json()["access_token"]

        client.post("/api/tourist/location", json={"lat": 1.0, "lng": 2.0}, headers=auth_header(token))
        profile = db.query(TouristProfile).first()
        assert profile is not None
        assert profile.current_lat == 1.0

    def test_location_creates_ping(self, client, db):
        create_tourist(db)
        token_resp = client.post("/auth/login", json={"email": "tourist@test.com", "password": "tourist123"})
        token = token_resp.json()["access_token"]

        client.post("/api/tourist/location", json={"lat": 1.0, "lng": 2.0, "accuracy": 5}, headers=auth_header(token))
        ping = db.query(LocationPing).first()
        assert ping is not None
        assert ping.lat == 1.0
        assert ping.accuracy == 5

    def test_location_history(self, client, db):
        create_tourist(db)
        token_resp = client.post("/auth/login", json={"email": "tourist@test.com", "password": "tourist123"})
        token = token_resp.json()["access_token"]

        # Submit a few pings
        for i in range(3):
            client.post("/api/tourist/location", json={"lat": float(i), "lng": float(i)}, headers=auth_header(token))

        resp = client.get("/api/tourist/location/history", headers=auth_header(token))
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 3
        assert data[0]["lat"] == 2.0  # most recent first

    def test_location_no_auth(self, client):
        resp = client.post("/api/tourist/location", json={"lat": 1, "lng": 2})
        assert resp.status_code == 401


class TestGeofencing:
    def test_inside_geofence(self, client, db):
        create_tourist(db)
        # Create a geofence around central Paris
        fence_geojson = json.dumps({
            "type": "Polygon",
            "coordinates": [[[2.30, 48.85], [2.36, 48.85], [2.36, 48.88], [2.30, 48.88], [2.30, 48.85]]]
        })
        db.add(Geofence(name="Paris", geojson=fence_geojson, is_active=True))
        db.commit()

        token_resp = client.post("/auth/login", json={"email": "tourist@test.com", "password": "tourist123"})
        token = token_resp.json()["access_token"]

        resp = client.post("/api/tourist/location", json={"lat": 48.86, "lng": 2.33}, headers=auth_header(token))
        assert resp.json()["in_safe_zone"] is True

    def test_outside_geofence(self, client, db):
        create_tourist(db)
        fence_geojson = json.dumps({
            "type": "Polygon",
            "coordinates": [[[2.30, 48.85], [2.36, 48.85], [2.36, 48.88], [2.30, 48.88], [2.30, 48.85]]]
        })
        db.add(Geofence(name="Paris", geojson=fence_geojson, is_active=True))
        db.commit()

        token_resp = client.post("/auth/login", json={"email": "tourist@test.com", "password": "tourist123"})
        token = token_resp.json()["access_token"]

        # London is outside Paris geofence
        resp = client.post("/api/tourist/location", json={"lat": 51.5074, "lng": -0.1278}, headers=auth_header(token))
        assert resp.json()["in_safe_zone"] is False

    def test_no_geofences_means_safe(self, client, db):
        create_tourist(db)
        token_resp = client.post("/auth/login", json={"email": "tourist@test.com", "password": "tourist123"})
        token = token_resp.json()["access_token"]

        resp = client.post("/api/tourist/location", json={"lat": 99.0, "lng": 99.0}, headers=auth_header(token))
        assert resp.json()["in_safe_zone"] is True

    def test_inactive_geofence_ignored(self, client, db):
        create_tourist(db)
        fence_geojson = json.dumps({
            "type": "Polygon",
            "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]
        })
        db.add(Geofence(name="Tiny", geojson=fence_geojson, is_active=False))
        db.commit()

        token_resp = client.post("/auth/login", json={"email": "tourist@test.com", "password": "tourist123"})
        token = token_resp.json()["access_token"]

        resp = client.post("/api/tourist/location", json={"lat": 0.5, "lng": 0.5}, headers=auth_header(token))
        assert resp.json()["in_safe_zone"] is True


class TestProfile:
    def test_get_empty_profile(self, client, db):
        create_tourist(db)
        token_resp = client.post("/auth/login", json={"email": "tourist@test.com", "password": "tourist123"})
        token = token_resp.json()["access_token"]

        resp = client.get("/api/tourist/profile", headers=auth_header(token))
        assert resp.status_code == 200
        assert resp.json() == {}

    def test_update_profile(self, client, db):
        create_tourist(db)
        token_resp = client.post("/auth/login", json={"email": "tourist@test.com", "password": "tourist123"})
        token = token_resp.json()["access_token"]

        resp = client.put("/api/tourist/profile", json={
            "nationality": "French",
            "emergency_contact_name": "Marie",
            "emergency_contact_phone": "+33123",
            "blood_type": "O+",
            "allergies": "Peanuts",
        }, headers=auth_header(token))
        assert resp.status_code == 200
        assert resp.json()["status"] == "updated"

        # Verify it was saved
        resp2 = client.get("/api/tourist/profile", headers=auth_header(token))
        data = resp2.json()
        assert data["nationality"] == "French"
        assert data["emergency_contact_name"] == "Marie"
        assert data["blood_type"] == "O+"

    def test_update_preferred_language(self, client, db):
        create_tourist(db)
        token_resp = client.post("/auth/login", json={"email": "tourist@test.com", "password": "tourist123"})
        token = token_resp.json()["access_token"]

        resp = client.put("/api/tourist/profile", json={"preferred_language": "fr"}, headers=auth_header(token))
        assert resp.status_code == 200

        me = client.get("/auth/me", headers=auth_header(token))
        assert me.json()["preferred_language"] == "fr"
