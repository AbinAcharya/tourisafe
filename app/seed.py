"""Seed script — creates an admin user and sample safe-zone for development.

Run: python -m app.seed
"""

import json
import sys
import os

# Ensure the project root is on the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal, engine, Base
from app.models import User, Geofence
from app.auth import hash_password


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # --- Admin user ---
    admin_email = "admin@tourisafe.local"
    existing = db.query(User).filter(User.email == admin_email).first()
    if existing:
        print(f"  Admin user already exists: {admin_email}")
    else:
        admin = User(
            email=admin_email,
            name="Admin",
            hashed_password=hash_password("admin123"),
            is_admin=True,
        )
        db.add(admin)
        print(f"  Created admin user: {admin_email} / admin123")

    # --- Sample tourist user ---
    tourist_email = "tourist@tourisafe.local"
    existing = db.query(User).filter(User.email == tourist_email).first()
    if existing:
        print(f"  Tourist user already exists: {tourist_email}")
    else:
        tourist = User(
            email=tourist_email,
            name="Demo Tourist",
            hashed_password=hash_password("tourist123"),
            is_admin=False,
        )
        db.add(tourist)
        print(f"  Created tourist user: {tourist_email} / tourist123")

    # --- Sample geofence (central Paris) ---
    existing_fence = db.query(Geofence).filter(Geofence.name == "Central Paris Safe Zone").first()
    if not existing_fence:
        paris_zone = {
            "type": "Polygon",
            "coordinates": [[
                [2.2945, 48.8584],
                [2.3504, 48.8584],
                [2.3504, 48.8734],
                [2.2945, 48.8734],
                [2.2945, 48.8584],
            ]],
        }
        gf = Geofence(
            name="Central Paris Safe Zone",
            description="Sample safe zone covering central Paris",
            geojson=json.dumps(paris_zone),
        )
        db.add(gf)
        print("  Created sample geofence: Central Paris Safe Zone")

    db.commit()
    db.close()
    print("\n  Seed complete!")


if __name__ == "__main__":
    seed()
