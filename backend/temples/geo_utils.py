from __future__ import annotations
from typing import Any, Dict, Tuple, Optional

def _is_geos_point(obj: Any) -> bool:
    # GEOS Point 互換: x=lon, y=lat を持つ
    return hasattr(obj, "x") and hasattr(obj, "y")

def to_lon_lat(value: Any) -> Optional[Tuple[float, float]]:
    """
    受け取り:
      - GEOS Point: x=lon, y=lat
      - dict: {"lat":..,"lng":..} / {"latitude":..,"longitude":..}
      - GeoJSON: {"type":"Point","coordinates":[lon,lat]}
      - (lat, lng) タプル/リスト
      - None
    戻り値: (lon, lat) or None
    """
    if value is None:
        return None

    # GeoDjango / GEOS Point （GeoDjangoが無くても _is_geos_point で拾える）
    try:
        from django.contrib.gis.geos import Point  # type: ignore
        if isinstance(value, Point):
            return float(value.x), float(value.y)
    except Exception:
        pass

    if _is_geos_point(value):
        try:
            return float(value.x), float(value.y)
        except Exception:
            return None

    if isinstance(value, dict):
        # {lat,lng} / {latitude,longitude}
        lat = value.get("lat", value.get("latitude"))
        lng = value.get("lng", value.get("longitude"))
        if lat is not None and lng is not None:
            try:
                return float(lng), float(lat)
            except Exception:
                return None
        # GeoJSON Point
        if value.get("type") == "Point" and "coordinates" in value:
            coords = value["coordinates"]
            if isinstance(coords, (list, tuple)) and len(coords) >= 2:
                try:
                    return float(coords[0]), float(coords[1])
                except Exception:
                    return None

    if isinstance(value, (list, tuple)) and len(value) >= 2:
        try:
            # (lat, lng) 前提で受けて (lon, lat) を返す
            lat, lng = value[0], value[1]
            return float(lng), float(lat)
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
