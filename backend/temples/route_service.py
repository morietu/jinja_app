# backend/temples/route_service.py
import hashlib
import json
import time
from dataclasses import dataclass
from os import getenv
from typing import Dict, List, Literal, Tuple

import requests
from django.core.cache import cache

Mode = Literal["walking", "driving"]


@dataclass
class Point:
    lat: float
    lng: float


# ---- 共通ユーティリティ ----
DEFAULT_TTL = 60 * 60 * 24 * 30  # 30日
_RATE_WINDOW = 60
_RATE_LIMIT = 20
_calls = []


def _allow() -> bool:
    now = time.time()
    while _calls and now - _calls[0] > _RATE_WINDOW:
        _calls.pop(0)
    if len(_calls) >= _RATE_LIMIT:
        return False
    _calls.append(now)
    return True


def _ck(prefix: str, payload: dict) -> str:
    h = hashlib.sha1(json.dumps(payload, sort_keys=True).encode()).hexdigest()
    return f"{prefix}:{h}"


# ---- 既存のダミー実装（残す） ----
def _interp_line(a: Point, b: Point, segments: int = 10):
    return [
        (a.lat + (b.lat - a.lat) * t / segments, a.lng + (b.lng - a.lng) * t / segments)
        for t in range(segments + 1)
    ]


def _haversine_m(a: Point, b: Point) -> float:
    R = 6371000
    from math import atan2, cos, radians, sin, sqrt

    dlat = radians(b.lat - a.lat)
    dlng = radians(b.lng - a.lng)
    x = sin(dlat / 2) ** 2 + cos(radians(a.lat)) * cos(radians(b.lat)) * sin(dlng / 2) ** 2
    return 2 * R * atan2(sqrt(x), sqrt(1 - x))


class BaseRouteAdapter:
    def get_leg(self, mode: Mode, a: Point, b: Point) -> Dict:
        raise NotImplementedError()


class DummyAdapter(BaseRouteAdapter):
    def get_leg(self, mode: Mode, a: Point, b: Point) -> Dict:
        distance = _haversine_m(a, b)
        speed_mps = 1.25 if mode == "walking" else 8.33
        duration = int(distance / speed_mps)
        geometry = _interp_line(a, b, segments=12)
        return {
            "from": {"lat": a.lat, "lng": a.lng},
            "to": {"lat": b.lat, "lng": b.lng},
            "distance_m": int(distance),
            "duration_s": duration,
            "geometry": geometry,
        }


# ---- 追加：ORS アダプタ ----
class ORSAdapter(BaseRouteAdapter):
    def __init__(self, base: str, key: str):
        self.base = base.rstrip("/")
        self.key = key

    def get_leg(self, mode: Mode, a: Point, b: Point) -> Dict:
        if not _allow():
            return {
                "from": {"lat": a.lat, "lng": a.lng},
                "to": {"lat": b.lat, "lng": b.lng},
                "distance_m": None,
                "duration_s": None,
                "geometry": None,
                "provider": "throttled",
            }
        profile = "foot-walking" if mode == "walking" else "driving-car"
        payload = {"coordinates": [[a.lng, a.lat], [b.lng, b.lat]]}
        ckey = _ck(f"ors:{profile}", payload)
        if hit := cache.get(ckey):
            return {**hit}

        url = f"{self.base}/v2/directions/{profile}"
        headers = {"Authorization": self.key}
        r = requests.post(url, json=payload, headers=headers, timeout=10)
        r.raise_for_status()
        feat = r.json()["features"][0]
        dist = int(feat["properties"]["summary"]["distance"])
        dur = int(feat["properties"]["summary"]["duration"])
        geom = feat["geometry"]["coordinates"]  # [[lng,lat], ...]
        # APIの座標は [lng,lat] → APIレスポンスに合わせるか、既存のSerializerに合わせて [lat,lng] に変換
        line = [(latlng[1], latlng[0]) for latlng in geom]
        res = {
            "from": {"lat": a.lat, "lng": a.lng},
            "to": {"lat": b.lat, "lng": b.lng},
            "distance_m": dist,
            "duration_s": dur,
            "geometry": line,
            "provider": "ors",
        }
        cache.set(ckey, res, DEFAULT_TTL)
        return res


# ---- 追加：OSRM フォールバック ----
class OSRMAdapter(BaseRouteAdapter):
    def __init__(self, base: str = "https://router.project-osrm.org"):
        self.base = base.rstrip("/")

    def get_leg(self, mode: Mode, a: Point, b: Point) -> Dict:
        if mode != "walking":
            # 簡易：当面は徒歩のみサポート
            return DummyAdapter().get_leg(mode, a, b)

        if not _allow():
            return {
                "from": {"lat": a.lat, "lng": a.lng},
                "to": {"lat": b.lat, "lng": b.lng},
                "distance_m": None,
                "duration_s": None,
                "geometry": None,
                "provider": "throttled",
            }

        url = f"{self.base}/route/v1/foot/{a.lng},{a.lat};{b.lng},{b.lat}?overview=full&geometries=geojson"
        r = requests.get(url, timeout=10)
        r.raise_for_status()
        route = r.json()["routes"][0]
        dist = int(route["distance"])
        dur = int(route["duration"])
        coords = route["geometry"]["coordinates"]  # [[lng,lat], ...]
        line = [(latlng[1], latlng[0]) for latlng in coords]
        return {
            "from": {"lat": a.lat, "lng": a.lng},
            "to": {"lat": b.lat, "lng": b.lng},
            "distance_m": dist,
            "duration_s": dur,
            "geometry": line,
            "provider": "osrm",
        }


# ---- Adapter選択（環境変数） ----
def get_adapter() -> Tuple[str, BaseRouteAdapter]:
    provider = (getenv("ROUTE_PROVIDER") or "dummy").lower()
    if provider == "ors":
        key = getenv("ORS_KEY", "")
        base = getenv("ORS_BASE", "https://api.openrouteservice.org")
        if key:
            return "ors", ORSAdapter(base, key)
        # キー未設定ならORS使えないので徒歩はOSRM
        return "osrm", OSRMAdapter()
    if provider == "osrm":
        return "osrm", OSRMAdapter()
    # 実装予定:
    # if provider == "google": ...
    return "dummy", DummyAdapter()


def build_route(mode: Mode, origin: Point, destinations: List[Point]) -> Dict:
    provider, adapter = get_adapter()
    legs = []
    current = origin
    for dest in destinations:
        try:
            legs.append(adapter.get_leg(mode, current, dest))
        except Exception:
            # 個別レッグ失敗時も落とさない（ダミー代替）
            legs.append(DummyAdapter().get_leg(mode, current, dest))
        current = dest
    distance_total = sum(int(leg["distance_m"] or 0) for leg in legs)
    duration_total = sum(int(leg["duration_s"] or 0) for leg in legs)
    return {
        "mode": mode,
        "legs": legs,
        "distance_m_total": distance_total,
        "duration_s_total": duration_total,
        "provider": provider,
    }
