import json
from shapely.geometry import shape, Point


def point_in_geojson(geojson_text: str, lat: float, lon: float) -> bool:
    try:
        gj = json.loads(geojson_text)
        geom = gj.get("geometry") if "geometry" in gj else gj
        poly = shape(geom)
        pt = Point(lon, lat)
        return poly.contains(pt) or poly.touches(pt)
    except Exception:
        return False
