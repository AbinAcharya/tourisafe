"""Database configuration and session management."""

import os

from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./tourisafe.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """Dependency that yields a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_schema():
    """Idempotent, non-destructive migrations for columns added after a DB was created.

    SQLAlchemy's create_all() only creates missing tables, never alters existing ones,
    so a column added to a model (e.g. users.google_sub) would be absent on an older DB.
    We add it with a plain ALTER TABLE when missing. We deliberately do NOT rebuild the
    users table to relax password_hash's NOT NULL constraint — Google users are given an
    unusable random password_hash sentinel instead, which keeps existing rows untouched.
    """
    with engine.begin() as conn:
        cols = {row[1] for row in conn.execute(text("PRAGMA table_info(users)"))}
        if "google_sub" not in cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN google_sub VARCHAR"))
        if "google_id" not in cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN google_id VARCHAR"))
        if "name" not in cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN name VARCHAR"))
        if "hashed_password" not in cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN hashed_password VARCHAR"))
        if "avatar_url" not in cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN avatar_url VARCHAR"))
        if "phone" not in cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN phone VARCHAR"))
