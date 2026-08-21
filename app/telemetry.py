from datetime import datetime
from geopy.distance import geodesic


def compute_speed_m_s(prev_point, prev_time: datetime, cur_point, cur_time: datetime):
    """Compute speed in meters per second between two points (lat, lon)."""
    try:
        dist_m = geodesic((prev_point[0], prev_point[1]), (cur_point[0], cur_point[1])).meters
        dt = (cur_time - prev_time).total_seconds()
        if dt <= 0:
            return 0.0
        return dist_m / dt
    except Exception:
        return 0.0
