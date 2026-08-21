import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.database import SessionLocal
from app import models, auth

if len(sys.argv) < 3:
    print('Usage: create_admin_user.py <username> <password>')
    sys.exit(1)

username = sys.argv[1]
password = sys.argv[2]

db = SessionLocal()
try:
    existing = db.query(models.User).filter(models.User.username==username).first()
    if existing:
        print('User already exists:', existing.username)
    else:
        try:
            ph = auth.get_password_hash(password)
        except Exception:
            ph = password
        admin = models.User(username=username, email=f'{username}@example.com', password_hash=ph, is_admin=True)
        db.add(admin)
        db.commit()
        db.refresh(admin)
        print(f'Created admin: {username} / (hidden) id={admin.id}')
finally:
    db.close()
