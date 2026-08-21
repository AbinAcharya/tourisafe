import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.database import SessionLocal
from app import models

db = SessionLocal()
try:
    target = db.query(models.User).filter(models.User.username == 'admin').all()
    if not target:
        print('No admin user with username "admin" found.')
    else:
        for u in target:
            print(f'Deleting user: id={u.id} username={u.username} is_admin={u.is_admin}')
            db.delete(u)
        db.commit()
        print('Deleted pre-created admin user(s).')
finally:
    db.close()
