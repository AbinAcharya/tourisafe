Tourisafe - Smart Tourist Safety System (Prototype)

Quick start (development):

1. Create a Python virtualenv and install dependencies:

```bash
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
```

2. Run the FastAPI server:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

Windows one-click start (recommended if you run on Windows):

Double-click `run.bat` or run from PowerShell/CMD:

```powershell
.\run.bat
```

Or use the PowerShell helper:

```powershell
.\start.ps1
```
```

3. Open the admin dashboard at http://localhost:8000/ (Leaflet map)

Notes:
- This prototype uses SQLite and stores GeoJSON polygons in the database. For production and advanced geospatial queries, use PostgreSQL + PostGIS and store geometry types.
- Replace `SECRET_KEY` in `app/auth.py` before deploying.
- Notification sending in `app/alerts.py` is a placeholder; integrate SMS, push, or regional authority webhooks there.
