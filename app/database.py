from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

SQLALCHEMY_DATABASE_URL = "sqlite:///./tourisafe.db"

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
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
