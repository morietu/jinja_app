# backend/temples/geo_utils.py
from __future__ import annotations
from typing import Any, Tuple, Optional
from .utils.geo import to_lon_lat, to_lat_lng_dict

__all__ = ["to_lon_lat", "to_lat_lng_dict"]

def to_lon_lat(obj: Any) -> Tuple[Optional[float], Optional[float]]:
    # GEOS Point
    if hasattr(obj, "x") and hasattr(obj, "y"):
        try:
            return float(obj.x), float(obj.y)
        except Exception:
            return None, None
    # GeoJSON-like dict {"type":"Point","coordinates":[lon,lat]}
    if isinstance(obj, dict):
        coords = obj.get("coordinates")
        if isinstance(coords, (list, tuple)) and len(coords) == 2:
            try:
                return float(coords[0]), float(coords[1])
            except Exception:
                return None, None
    # tuple/list (lon, lat)
    if isinstance(obj, (list, tuple)) and len(obj) == 2:
        try:
            return float(obj[0]), float(obj[1])
        except Exception:
            return None, None
    return None, None

def to_lat_lng_dict(obj: Any) -> Optional[dict]:
    lon, lat = to_lon_lat(obj)
    if lon is None or lat is None:
        return None
    return {"lat": lat, "lng": lon}
