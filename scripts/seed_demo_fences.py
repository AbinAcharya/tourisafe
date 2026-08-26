"""One-off dev helper: seed a few clearly-labelled demo safety zones so the map
has something to render while working on the UI. Reversible via the admin
"Clear all zones" button or scripts/... deletes. Run: .venv/Scripts/python.exe scripts/seed_demo_fences.py
"""
import sys, os, json
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.database import SessionLocal
from app import models


def rect(lon, lat, w=0.012, h=0.010):
    return {"type": "Polygon", "coordinates": [[
        [lon - w, lat - h], [lon + w, lat - h],
        [lon + w, lat + h], [lon - w, lat + h],
        [lon - w, lat - h],
    ]]}


DEMOS = [
    ("Demo · Cubbon restricted", "restricted", rect(77.5946, 12.9763)),
    ("Demo · Koramangala high-risk", "high-risk", rect(77.6387, 12.9352)),
    ("Demo · Indiranagar safe zone", "safe", rect(77.6408, 12.9719)),
]

db = SessionLocal()
try:
    created = 0
    for name, ftype, geom in DEMOS:
        exists = db.query(models.GeoFence).filter(models.GeoFence.name == name).first()
        if exists:
            print("skip (exists):", name)
            continue
        db.add(models.GeoFence(name=name, fence_type=ftype, geojson=json.dumps(geom)))
        created += 1
    db.commit()
    print(f"Seeded {created} demo fence(s).")
finally:
    db.close()
