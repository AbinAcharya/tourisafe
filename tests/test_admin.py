"""Tests for admin API: tourists, alerts, geofences, telemetry, authorization."""

import json
import pytest

from app.models import User, TouristProfile, SOSAlert, LocationPing, Geofence
from tests.conftest import create_admin, create_tourist, auth_header


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def login_admin(client, email="admin@test.com", password="admin123"):
    resp = client.post("/auth/login", json={"email": email, "password": password})
    return resp.json()["access_token"]


def login_tourist(client, email="tourist@test.com", password="tourist123"):
    resp = client.post("/auth/login", json={"email": email, "password": password})
    return resp.json()["access_token"]


# ---------------------------------------------------------------------------
# Authorization
# ---------------------------------------------------------------------------

class TestAdminAuthorization:
    def test_tourist_cannot_access_admin_endpoints(self, client, db):
        create_tourist(db)
        token = login_tourist(client)

        for path in ["/api/admin/tourists", "/api/admin/alerts", "/api/admin/geofences"]:
            resp = client.get(path, headers=auth_header(token))
            assert resp.status_code == 403, f"{path} should be 403 for tourist"

    def test_unauthenticated_cannot_access_admin(self, client):
        resp = client.get("/api/admin/tourists")
        assert resp.status_code == 401

    def test_admin_can_access(self, client, db):
        create_admin(db)
        token = login_admin(client)
        resp = client.get("/api/admin/tourists", headers=auth_header(token))
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Tourist listing
# ---------------------------------------------------------------------------

class TestTouristListing:
    def test_lists_tourists_with_profiles(self, client, db):
        create_admin(db)
        tourist = create_tourist(db)
        profile = TouristProfile(user_id=tourist.id, current_lat=48.85, current_lng=2.35, is_in_zone=True)
        db.add(profile)
        db.commit()

        token = login_admin(client)
        resp = client.get("/api/admin/tourists", headers=auth_header(token))
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["lat"] == 48.85
        assert data[0]["name"] == "Test Tourist"

    def test_empty_when_no_tourists(self, client, db):
        create_admin(db)
        token = login_admin(client)
        resp = client.get("/api/admin/tourists", headers=auth_header(token))
        assert resp.json() == []


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------

class TestAdminAlerts:
    def test_list_alerts_empty(self, client, db):
        create_admin(db)
        token = login_admin(client)
        resp = client.get("/api/admin/alerts", headers=auth_header(token))
        assert resp.json() == []

    def test_list_alerts_after_sos(self, client, db):
        create_admin(db)
        tourist = create_tourist(db)
        alert = SOSAlert(tourist_id=tourist.id, lat=48.85, lng=2.35, message="Help")
        db.add(alert)
        db.commit()

        token = login_admin(client)
        resp = client.get("/api/admin/alerts", headers=auth_header(token))
        data = resp.json()
        assert len(data) == 1
        assert data[0]["tourist_name"] == "Test Tourist"
        assert data[0]["status"] == "active"

    def test_filter_by_status(self, client, db):
        create_admin(db)
        tourist = create_tourist(db)
        db.add(SOSAlert(tourist_id=tourist.id, status="active"))
        db.add(SOSAlert(tourist_id=tourist.id, status="resolved"))
        db.commit()

        token = login_admin(client)
        resp = client.get("/api/admin/alerts?status_filter=active", headers=auth_header(token))
        assert len(resp.json()) == 1

    def test_resolve_alert(self, client, db):
        create_admin(db)
        tourist = create_tourist(db)
        alert = SOSAlert(tourist_id=tourist.id, status="active")
        db.add(alert)
        db.commit()

        token = login_admin(client)
        resp = client.patch(f"/api/admin/alerts/{alert.id}", json={"status": "resolved"}, headers=auth_header(token))
        assert resp.status_code == 200
        assert resp.json()["status"] == "updated"

        db.refresh(alert)
        assert alert.status == "resolved"
        assert alert.resolved_at is not None
        assert alert.resolved_by is not None

    def test_resolve_nonexistent_alert(self, client, db):
        create_admin(db)
        token = login_admin(client)
        resp = client.patch("/api/admin/alerts/99999", json={"status": "resolved"}, headers=auth_header(token))
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Geofences
# ---------------------------------------------------------------------------

class TestAdminGeofences:
    def test_create_geofence(self, client, db):
        create_admin(db)
        token = login_admin(client)

        geojson = json.dumps({
            "type": "Polygon",
            "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]
        })
        resp = client.post("/api/admin/geofences", json={
            "name": "Test Zone",
            "description": "A test zone",
            "geojson": geojson,
        }, headers=auth_header(token))
        assert resp.status_code == 200
        assert resp.json()["status"] == "created"

    def test_create_invalid_geojson(self, client, db):
        create_admin(db)
        token = login_admin(client)
        resp = client.post("/api/admin/geofences", json={
            "name": "Bad Zone",
            "geojson": "not valid json",
        }, headers=auth_header(token))
        assert resp.status_code == 400

    def test_list_geofences(self, client, db):
        create_admin(db)
        token = login_admin(client)

        resp = client.get("/api/admin/geofences", headers=auth_header(token))
        assert resp.json() == []

    def test_delete_geofence(self, client, db):
        create_admin(db)
        gf = Geofence(name="Delete Me", geojson='{"type":"Polygon","coordinates":[]}')
        db.add(gf)
        db.commit()
        db.refresh(gf)

        token = login_admin(client)
        resp = client.delete(f"/api/admin/geofences/{gf.id}", headers=auth_header(token))
        assert resp.status_code == 200
        assert db.query(Geofence).filter(Geofence.id == gf.id).first() is None

    def test_delete_nonexistent_geofence(self, client, db):
        create_admin(db)
        token = login_admin(client)
        resp = client.delete("/api/admin/geofences/99999", headers=auth_header(token))
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Telemetry
# ---------------------------------------------------------------------------

class TestTelemetry:
    def test_telemetry_history(self, client, db):
        create_admin(db)
        tourist = create_tourist(db)
        for i in range(5):
            from datetime import datetime, timedelta
            db.add(LocationPing(tourist_id=tourist.id, lat=float(i), lng=float(i),
                               timestamp=datetime.utcnow() + timedelta(seconds=i)))
        db.commit()

        token = login_admin(client)
        resp = client.get(f"/api/admin/telemetry/{tourist.id}", headers=auth_header(token))
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 5
        # Most recent first — lat 4.0 is last inserted with latest timestamp
        assert data[0]["lat"] == 4.0

    def test_telemetry_other_tourist(self, client, db):
        """Admin can view any tourist's telemetry."""
        create_admin(db)
        t1 = create_tourist(db, email="t1@test.com")
        t2 = create_tourist(db, email="t2@test.com")
        db.add(LocationPing(tourist_id=t2.id, lat=99.0, lng=99.0))
        db.commit()

        token = login_admin(client)
        resp = client.get(f"/api/admin/telemetry/{t2.id}", headers=auth_header(token))
        assert len(resp.json()) == 1
        assert resp.json()[0]["lat"] == 99.0
