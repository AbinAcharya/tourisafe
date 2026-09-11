"""Alert notification stubs.

Integrate SMS, push, or regional authority webhooks here.
"""

import logging
from datetime import datetime

from sqlalchemy.orm import Session
from app.models import SOSAlert, TouristProfile, User

logger = logging.getLogger(__name__)


def notify_authorities(incident_id: int) -> None:
    """Compatibility stub for notifying relevant authorities about an SOS incident.

    The project's SOS endpoint invokes this helper without a database session,
    so this function intentionally keeps the API tiny and logs the alert instead
    of trying to reach external services in the default prototype setup.
    """

    logger.warning("SOS authority notification triggered for incident %s", incident_id)


# Backward compatibility for older typoed call sites.
notify_authoritites = notify_authorities


async def notify_emergency_services(alert: SOSAlert, db: Session) -> None:
    """Placeholder: send SOS to emergency services / authorities."""
    tourist = db.query(User).filter(User.id == alert.tourist_id).first()
    logger.warning(
        "SOS ALERT %s — Tourist: %s (%s) Location: %s, %s Message: %s",
        alert.id,
        tourist.name if tourist else "Unknown",
        tourist.email if tourist else "",
        alert.lat,
        alert.lng,
        alert.message,
    )
    # TODO: integrate Twilio / Firebase / regional authority webhook


async def notify_emergency_contact(alert: SOSAlert, db: Session) -> None:
    """Placeholder: notify the tourist's designated emergency contact."""
    profile = db.query(TouristProfile).filter(TouristProfile.user_id == alert.tourist_id).first()
    if profile and profile.emergency_contact_phone:
        logger.info(
            "Would SMS %s (%s) about SOS from tourist %s at %s, %s",
            profile.emergency_contact_name,
            profile.emergency_contact_phone,
            alert.tourist_id,
            alert.lat,
            alert.lng,
        )
        # TODO: integrate Twilio / Vonage SMS API


async def notify_admins(alert: SOSAlert, db: Session) -> None:
    """Placeholder: push notification to admin dashboard."""
    admins = db.query(User).filter(User.is_admin == True, User.is_active == True).all()
    for admin in admins:
        logger.info("Would push SOS notification to admin %s (%s)", admin.name, admin.email)
