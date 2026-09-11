"""Tests for auth module: password hashing, JWT, Google OAuth, user lookup."""

import os
import pytest
from datetime import timedelta
from jose import JWTError

from app.models import User
from app.auth import (
    hash_password,
    verify_password,
    create_access_token,
    decode_token,
    google_auth_url,
    find_or_create_google_user,
    SECRET_KEY,
    ALGORITHM,
)
from tests.conftest import create_admin, create_tourist


# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------

class TestPasswordHashing:
    def test_hash_and_verify(self):
        hashed = hash_password("mypassword")
        assert verify_password("mypassword", hashed) is True

    def test_wrong_password_fails(self):
        hashed = hash_password("mypassword")
        assert verify_password("wrongpassword", hashed) is False

    def test_different_hashes_for_same_password(self):
        h1 = hash_password("samepass")
        h2 = hash_password("samepass")
        assert h1 != h2  # bcrypt uses random salt each time


# ---------------------------------------------------------------------------
# JWT tokens
# ---------------------------------------------------------------------------

class TestJWT:
    def test_create_and_decode(self):
        token = create_access_token({"sub": 42, "email": "a@b.com"})
        payload = decode_token(token)
        assert payload["sub"] == 42
        assert payload["email"] == "a@b.com"
        assert "exp" in payload

    def test_custom_expiry(self):
        token = create_access_token({"sub": 1}, expires_delta=timedelta(seconds=1))
        payload = decode_token(token)
        assert payload["sub"] == 1

    def test_invalid_token_raises(self):
        with pytest.raises(JWTError):
            decode_token("not.a.valid.token")

    def test_tampered_token_raises(self):
        token = create_access_token({"sub": 1})
        # Tamper with the token
        tampered = token[:-5] + "XXXXX"
        with pytest.raises(JWTError):
            decode_token(tampered)


# ---------------------------------------------------------------------------
# Google OAuth URL
# ---------------------------------------------------------------------------

class TestGoogleOAuth:
    def test_auth_url_contains_client_id(self):
        os.environ["GOOGLE_CLIENT_ID"] = "test-client-id.apps.googleusercontent.com"
        # Reload the module to pick up the env change
        import importlib
        import app.auth
        original = app.auth.GOOGLE_CLIENT_ID
        app.auth.GOOGLE_CLIENT_ID = "test-client-id.apps.googleusercontent.com"
        try:
            url = google_auth_url(state="test-state")
            assert "client_id=test-client-id.apps.googleusercontent.com" in url
            assert "state=test-state" in url
            assert "accounts.google.com" in url
            assert "scope=" in url and "openid" in url and "email" in url
        finally:
            app.auth.GOOGLE_CLIENT_ID = original

    def test_auth_url_raises_when_no_client_id(self):
        import app.auth
        original = app.auth.GOOGLE_CLIENT_ID
        app.auth.GOOGLE_CLIENT_ID = ""
        try:
            from fastapi import HTTPException
            with pytest.raises(HTTPException) as exc_info:
                google_auth_url()
            assert exc_info.value.status_code == 503
        finally:
            app.auth.GOOGLE_CLIENT_ID = original


# ---------------------------------------------------------------------------
# find_or_create_google_user
# ---------------------------------------------------------------------------

class TestFindOrCreateGoogleUser:
    def test_creates_new_user(self, db):
        info = {"sub": "g-123", "email": "new@gmail.com", "name": "New User", "picture": "http://img.jpg"}
        user = find_or_create_google_user(db, info)
        assert user.email == "new@gmail.com"
        assert user.google_id == "g-123"
        assert user.name == "New User"
        assert user.avatar_url == "http://img.jpg"
        assert user.is_admin is False

    def test_links_existing_email(self, db):
        existing = create_tourist(db, email="existing@gmail.com")
        info = {"sub": "g-456", "email": "existing@gmail.com", "name": "Linked User"}
        user = find_or_create_google_user(db, info)
        assert user.id == existing.id
        assert user.google_id == "g-456"

    def test_finds_by_google_id(self, db):
        existing = create_tourist(db, email="old@gmail.com")
        existing.google_id = "g-789"
        db.commit()

        info = {"sub": "g-789", "email": "different@gmail.com", "name": "Same Person"}
        user = find_or_create_google_user(db, info)
        assert user.id == existing.id
        assert user.avatar_url == ""


# ---------------------------------------------------------------------------
# Email/password registration and login via API
# ---------------------------------------------------------------------------

class TestAuthAPI:
    def test_register_success(self, client):
        resp = client.post("/auth/register", json={
            "email": "new@test.com",
            "password": "pass123",
            "name": "New User",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["user"]["email"] == "new@test.com"
        assert data["user"]["name"] == "New User"

    def test_register_duplicate_email(self, client, db):
        create_tourist(db, email="dup@test.com")
        resp = client.post("/auth/register", json={
            "email": "dup@test.com",
            "password": "pass123",
            "name": "Dup",
        })
        assert resp.status_code == 400
        assert "already registered" in resp.json()["detail"]

    def test_login_success(self, client, db):
        create_tourist(db, email="login@test.com", password="mypass")
        resp = client.post("/auth/login", json={
            "email": "login@test.com",
            "password": "mypass",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["user"]["is_admin"] is False

    def test_login_wrong_password(self, client, db):
        create_tourist(db, email="login@test.com", password="mypass")
        resp = client.post("/auth/login", json={
            "email": "login@test.com",
            "password": "wrongpass",
        })
        assert resp.status_code == 401

    def test_login_nonexistent_user(self, client):
        resp = client.post("/auth/login", json={
            "email": "nobody@test.com",
            "password": "pass",
        })
        assert resp.status_code == 401

    def test_login_oauth_only_user(self, client, db):
        """User who registered via Google (no password) cannot login with email/password."""
        user = User(email="oauth@test.com", name="OAuth User", hashed_password=None, google_id="g-999")
        db.add(user)
        db.commit()

        resp = client.post("/auth/login", json={
            "email": "oauth@test.com",
            "password": "anything",
        })
        assert resp.status_code == 401
        assert "Invalid credentials" in resp.json()["detail"]

    def test_me_endpoint(self, client, db):
        create_tourist(db, email="me@test.com", password="pass")
        login = client.post("/auth/login", json={"email": "me@test.com", "password": "pass"})
        token = login.json()["access_token"]

        resp = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["email"] == "me@test.com"

    def test_me_endpoint_no_auth(self, client):
        resp = client.get("/auth/me")
        assert resp.status_code == 401
