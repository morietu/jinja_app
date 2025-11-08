from __future__ import annotations
from typing import Any, Optional, Tuple, Dict

def to_lon_lat(value: Any) -> Optional[Tuple[float, float]]:
    """多様な入力から (lon, lat) を取り出す。該当なしは None を返す。"""
    if value is None:
        return None

    # GeoDjango / GEOS Point（x=lon, y=lat）
    try:
        from django.contrib.gis.geos import Point  # type: ignore
        if isinstance(value, Point):
            return float(value.x), float(value.y)
    except Exception:
        pass  # GeoDjangoが未導入でも落とさない

    # x/y属性だけ持つオブジェクト（GEOS互換）
    if hasattr(value, "x") and hasattr(value, "y"):
        try:
            return float(value.x), float(value.y)
        except Exception:
            return None

    # dict パターン
    if isinstance(value, dict):
        # GeoJSON: {"type":"Point","coordinates":[lon,lat]}
        if value.get("type") == "Point" and "coordinates" in value:
            coords = value["coordinates"]
            if isinstance(coords, (list, tuple)) and len(coords) >= 2:
                try:
                    return float(coords[0]), float(coords[1])
                except Exception:
                    return None
        # {lat: .., lng: ..} / {latitude:.., longitude:..}
        lat = value.get("lat", value.get("latitude"))
        lng = value.get("lng", value.get("longitude"))
        if lat is not None and lng is not None:
            try:
                return float(lng), float(lat)
            except Exception:
                return None

    # list/tuple は (lon, lat) 前提で受ける
    if isinstance(value, (list, tuple)) and len(value) >= 2:
        try:
            return float(value[0]), float(value[1])
        except Exception:
            return None

    return None


def to_lat_lng_dict(value: Any) -> Optional[Dict[str, float]]:
    """(lon, lat) を {lat, lng} に変換。該当なしは None。"""
    pair = to_lon_lat(value)
    if pair is None:
        return None
    lon, lat = pair
    return {"lat": float(lat), "lng": float(lon)}


__all__ = ["to_lon_lat", "to_lat_lng_dict"]
