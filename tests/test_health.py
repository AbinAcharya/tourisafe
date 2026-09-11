"""Tests for health endpoint and HTML page routes."""


class TestHealth:
    def test_health_returns_ok(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["app"] == "tourisafe"


class TestPageRoutes:
    def test_admin_dashboard_loads(self, client):
        resp = client.get("/")
        assert resp.status_code == 200
        assert "Tourisafe" in resp.text
        assert "leaflet" in resp.text.lower() or "map" in resp.text.lower()

    def test_login_page_loads(self, client):
        resp = client.get("/login")
        assert resp.status_code == 200
        assert "Sign in" in resp.text
        assert "Google" in resp.text

    def test_tourist_page_loads(self, client):
        resp = client.get("/tourist")
        assert resp.status_code == 200
        assert "SOS" in resp.text
        assert "Profile" in resp.text

    def test_docs_available(self, client):
        resp = client.get("/docs")
        assert resp.status_code == 200
