import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.database import SessionLocal
from app import models, auth

db = SessionLocal()
try:
    existing = db.query(models.User).filter(models.User.username=='admin').first()
    if existing:
        print('Admin already exists:', existing.username)
    else:
        try:
            ph = auth.get_password_hash('admin')
        except Exception:
            ph = 'admin'
        admin = models.User(username='admin', email='admin@example.com', password_hash=ph, is_admin=True)
        db.add(admin)
        db.commit()
        db.refresh(admin)
        print('Created admin: admin / admin')
finally:
    db.close()
