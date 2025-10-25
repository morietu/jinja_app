# backend/temples/route_service.py
import hashlib
import json
import time
from dataclasses import dataclass
from os import getenv
from typing import Dict, List, Literal, Tuple

import requests
from django.conf import settings
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


ROUTE_CACHE_TTL_S = int(getattr(settings, "ROUTE_CACHE_TTL_S", 60 * 60 * 24 * 30))


def _cache_key(mode: Mode, origin: Point, destinations: List[Point]) -> str:
    payload = {
        "mode": mode,
        "origin": {"lat": origin.lat, "lng": origin.lng},
        "destinations": [{"lat": d.lat, "lng": d.lng} for d in destinations],
    }
    h = hashlib.sha1(json.dumps(payload, sort_keys=True).encode()).hexdigest()
    return f"route:{h}"


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
                "distance_m": 0,  # ← None ではなく 0
                "duration_s": 0,  # ← None ではなく 0
                "geometry": [],  # ← 空配列
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
        cache.set(ckey, res, ROUTE_CACHE_TTL_S)
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
    # 1) pytest 中は常に dummy（外部アクセス禁止）
    if getattr(settings, "IS_PYTEST", False):
        provider = "dummy"
    else:
        # 2) settings を最優先、無ければ環境変数、最後に既定
        provider = getattr(settings, "ROUTE_PROVIDER", None)
        if provider:
            provider = provider.lower()
        else:
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
    # ★ まずキャッシュを見る
    ckey = _cache_key(mode, origin, destinations)
    hit = cache.get(ckey)
    if hit:
        # 既存レスポンスに cached フラグを付けて返す
        res = dict(hit)
        res["cached"] = True
        return res

    provider, adapter = get_adapter()
    legs = []
    current = origin
    for dest in destinations:
        leg = adapter.get_leg(mode, current, dest)
        legs.append(leg)
        current = dest
    distance_total = sum(leg["distance_m"] for leg in legs)
    duration_total = sum(leg["duration_s"] for leg in legs)

    res = {
        "mode": mode,
        "legs": legs,
        "distance_m_total": distance_total,
        "duration_s_total": duration_total,
        "provider": provider,
        "cached": False,  # ★ 初回は False
    }

    # ★ キャッシュ保存
    cache.set(ckey, res, ROUTE_CACHE_TTL_S)
    return res
