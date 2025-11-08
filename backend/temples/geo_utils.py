# backend/temples/geo_utils.py
from typing import Any, Dict, Tuple

LonLat = Tuple[float, float]

def _to_float(v: Any) -> float:
    return float(v)  # str/Decimal なども許容

def to_lon_lat(value: Any) -> LonLat:
    """
    受け取り:
     - GeoJSON Point: {"type":"Point","coordinates":[lon, lat]}
      - (lat, lng) もしくは (lon, lat) のタプル/リスト（ヒューリスティックで判定）
      - {"lat": .., "lng"| "lon" | "longitude": ..} / {"latitude":..}
      - GEOS/Shapely 風 (x=lon, y=lat)
    """
    # GEOS/Shapely 風オブジェクト
    if hasattr(value, "x") and hasattr(value, "y"):
        return (_to_float(value.x), _to_float(value.y))

    # dict: GeoJSON or lat/lng map
    if isinstance(value, dict):
        # GeoJSON Point
        if value.get("type") == "Point" and isinstance(value.get("coordinates"), (list, tuple)) and len(value["coordinates"]) == 2:
            lon, lat = value["coordinates"]
            return (_to_float(lon), _to_float(lat))
        lat = value.get("lat") or value.get("latitude")
        lng = (
            value.get("lng")
            or value.get("lon")
            or value.get("longitude")
        )
        if lat is None or lng is None:
            raise KeyError("lat/lng (or lon/latitude/longitude) が不足")
        return (_to_float(lng), _to_float(lat))
    # (lat,lng) or (lon,lat)
    if isinstance(value, (list, tuple)) and len(value) == 2:
        a, b = value
        # 緯度の絶対値は通常 <= 90、経度は <= 180 を利用して推定
        if abs(float(a)) <= 90 and abs(float(b)) <= 180:
            # (lat, lng)
            return (_to_float(b), _to_float(a))
        # それ以外は (lon, lat) とみなす
        return (_to_float(a), _to_float(b))
    


    # (lat, lng) / [lat, lng]
    if isinstance(value, (tuple, list)) and len(value) == 2:
        lat, lng = value
        return (_to_float(lng), _to_float(lat))

    raise TypeError("to_lon_lat: 未対応の入力型")

def to_lat_lng_dict(value: Any) -> Dict[str, float]:
    """
    受け取り:
      - (lon, lat) タプル/リスト
      - {"lat":.., "lng"/"lon":..}
      - GEOS/Shapely 風オブジェクト
    返却:
      - {"lat": float, "lng": float}
    """
    if hasattr(value, "x") and hasattr(value, "y"):
        return {"lat": _to_float(value.y), "lng": _to_float(value.x)}

    if isinstance(value, dict):
        # 既に {lat,lng} なら正規化、{lat,lon} も許容
        lat = value.get("lat") or value.get("latitude")
        lng = value.get("lng") or value.get("lon") or value.get("longitude")
        if lat is None or lng is None:
            raise KeyError("lat/lng (or lon/latitude/longitude) が不足")
        return {"lat": _to_float(lat), "lng": _to_float(lng)}

    if isinstance(value, (tuple, list)) and len(value) == 2:
        lon, lat = value
        return {"lat": _to_float(lat), "lng": _to_float(lon)}

    raise TypeError("to_lat_lng_dict: 未対応の入力型")
