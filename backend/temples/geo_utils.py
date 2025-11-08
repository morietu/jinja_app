from typing import Any, Dict, Tuple, Optional

def _is_geos_point(obj: Any) -> bool:
    return hasattr(obj, "x") and hasattr(obj, "y")

def to_lon_lat(value: Any) -> Optional[Tuple[float, float]]:
    """
    受け取り:
      - GEOS Point: x=lon, y=lat
      - dict: {"lat":..,"lng":..} / {"latitude":..,"longitude":..}
      - (lat, lng) タプル/リスト
      - None
    戻り値: (lon, lat) or None
    """
    if value is None:
        return None
    if _is_geos_point(value):
        return float(value.x), float(value.y)
    if isinstance(value, dict):
        lat = value.get("lat", value.get("latitude"))
        lng = value.get("lng", value.get("longitude"))
        if lat is not None and lng is not None:
            return float(lng), float(lat)
    if isinstance(value, (list, tuple)) and len(value) == 2:
        lat, lng = value
        return float(lng), float(lat)
    return None

def to_lat_lng_dict(value: Any) -> Optional[Dict[str, float]]:
    lon_lat = to_lon_lat(value)
    if lon_lat is None:
        return None
    lon, lat = lon_lat
    return {"lat": float(lat), "lng": float(lon)}

__all__ = ["to_lon_lat", "to_lat_lng_dict"]
