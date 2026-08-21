import os
import requests
from .models import Notification
from .database import SessionLocal
from datetime import datetime
from .ws import manager


def notify_authorities(incident_id: int, channel: str = "webhook"):
    db = SessionLocal()
    try:
        n = Notification(incident_id=incident_id, channel=channel, sent=False, created_at=datetime.utcnow())
        db.add(n)
        db.commit()
        db.refresh(n)
    finally:
        db.close()

    # send webhook if configured
    webhook = os.environ.get('TOURISAFE_NOTIFICATION_WEBHOOK')
    payload = {"incident_id": incident_id, "channel": channel}
    sent = False
    if webhook:
        try:
            requests.post(webhook, json=payload, timeout=5)
            sent = True
        except Exception:
            sent = False

    # update notification record
    db = SessionLocal()
    try:
        rec = db.query(Notification).filter(Notification.id == n.id).first()
        if rec:
            rec.sent = sent
            db.commit()
    finally:
        db.close()

    # broadcast to connected websocket clients
    try:
        import asyncio
        asyncio.create_task(manager.broadcast({"type": "incident_notification", "incident_id": incident_id}))
    except Exception:
        pass

