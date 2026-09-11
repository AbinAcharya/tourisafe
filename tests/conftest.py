"""Shared fixtures: in-memory SQLite, test client, seeded users."""

import os

# Set SECRET_KEY before any app imports (auth.py checks at import time)
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-ci-only")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import User, Geofence
from app.auth import hash_password

# ---------------------------------------------------------------------------
# In-memory database for tests — StaticPool ensures all connections share the
# same in-memory SQLite so tables persist across the setup_db fixture and API
# requests made by TestClient.
# ---------------------------------------------------------------------------
TEST_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_db():
    """Create tables before each test, drop after."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client():
    return TestClient(app)


@pytest.fixture()
def db():
    session = TestSession()
    try:
        yield session
    finally:
        session.close()


# ---------------------------------------------------------------------------
# Seed helpers
# ---------------------------------------------------------------------------
def create_admin(db, email="admin@test.com", password="admin123"):
    user = User(
        email=email,
        name="Test Admin",
        hashed_password=hash_password(password),
        is_admin=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def create_tourist(db, email="tourist@test.com", password="tourist123"):
    user = User(
        email=email,
        name="Test Tourist",
        hashed_password=hash_password(password),
        is_admin=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def auth_header(token):
    return {"Authorization": f"Bearer {token}"}
