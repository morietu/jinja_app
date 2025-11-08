# backend/temples/geo_utils.py
from typing import Any, Dict, Optional, Tuple

def to_lon_lat(value: Any) -> Optional[Tuple[float, float]]:
    """さまざまな入力を (lon, lat) に正規化して返す。解釈できなければ None。"""
    if value is None:
        return None

    # 1) GeoJSON: {"type":"Point","coordinates":[lon,lat]}
    if isinstance(value, dict) and value.get("type") == "Point" and "coordinates" in value:
        coords = value["coordinates"]
        if isinstance(coords, (list, tuple)) and len(coords) >= 2:
            try:
                return float(coords[0]), float(coords[1])
            except Exception:
                return None

    # 2) GeoDjango / GEOS Point
    try:
        from django.contrib.gis.geos import Point  # type: ignore
        if isinstance(value, Point):
            # Point.x=lon, Point.y=lat
            return float(value.x), float(value.y)
    except Exception:
        pass  # GeoDjango 未インストール環境でも落ちない

    # 3) x/y 属性（GEOS互換）
    if hasattr(value, "x") and hasattr(value, "y"):
        try:
            return float(value.x), float(value.y)
        except Exception:
            return None

    # 4) dict: {lat,lng} / {latitude,longitude}
    if isinstance(value, dict):
        lat = value.get("lat", value.get("latitude"))
        lng = value.get("lng", value.get("longitude"))
        if lat is not None and lng is not None:
            try:
                return float(lng), float(lat)
            except Exception:
                return None

    # 5) list/tuple は (lon, lat) 前提
    if isinstance(value, (list, tuple)) and len(value) >= 2:
        try:
            lon, lat = value[0], value[1]
            return float(lon), float(lat)
        except Exception:
            return None

    return None


def to_lat_lng_dict(value: Any) -> Optional[Dict[str, float]]:
    pair = to_lon_lat(value)
    if pair is None:
        return None
    lon, lat = pair
    return {"lat": float(lat), "lng": float(lon)}

__all__ = ["to_lon_lat", "to_lat_lng_dict"]
