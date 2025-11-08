# backend/temples/geo_utils.py
from typing import Any, Dict, Tuple, Optional

LonLat = Tuple[float, float]

def _to_float(v: Any) -> float:
    return float(v)

def to_lon_lat(value: Any) -> LonLat:
    """
    入力を (lon, lat) に正規化。
    サポート:
      - GeoJSON Point: {"type":"Point","coordinates":[lon, lat]}
      - (lat, lng) または (lon, lat) の2要素
      - {"lat":.., "lng"/"lon"/"longitude":..} / {"latitude":..}
      - GEOS/Shapely風: x=lon, y=lat
    """
    # None/空は未対応（呼び出し側で to_lat_lng_dict が面倒を見る）
    if value in (None, ""):
        raise TypeError("to_lon_lat: 未対応の入力型")

    # GEOS/Shapely 風
    if hasattr(value, "x") and hasattr(value, "y"):
        return (_to_float(value.x), _to_float(value.y))

    # dict
    if isinstance(value, dict):
        # GeoJSON Point
        if value.get("type") == "Point" and isinstance(value.get("coordinates"), (list, tuple)) and len(value["coordinates"]) == 2:
            lon, lat = value["coordinates"]
            return (_to_float(lon), _to_float(lat))
        # lat/lng マップ
        lat = value.get("lat") or value.get("latitude")
        lng = value.get("lng") or value.get("lon") or value.get("longitude")
        if lat is None or lng is None:
            raise KeyError("lat/lng (or lon/latitude/longitude) が不足")
        return (_to_float(lng), _to_float(lat))

    # 2要素
    if isinstance(value, (list, tuple)) and len(value) == 2:
        a, b = value
        if abs(float(a)) <= 90 and abs(float(b)) <= 180:  # (lat, lng)
            return (_to_float(b), _to_float(a))
        return (_to_float(a), _to_float(b))               # (lon, lat)

    raise TypeError("to_lon_lat: 未対応の入力型")

def to_lat_lng_dict(value: Any) -> Optional[Dict[str, float]]:
    """
    位置を {lat, lng} に正規化。None/空は None を返す（nullable）。
    """
    # ★ ここが重要：populars など location が NULL の行を安全に処理
    if value in (None, ""):
        return None

    lon, lat = to_lon_lat(value)
    return {"lat": _to_float(lat), "lng": _to_float(lon)}
