# ルート取得サービス（Adapterパターン）

from dataclasses import dataclass
from os import getenv
from typing import Dict, List, Literal, Tuple

Mode = Literal["walking", "driving"]


@dataclass
class Point:
    lat: float
    lng: float


def _interp_line(a: Point, b: Point, segments: int = 10) -> List[Tuple[float, float]]:
    # 直線補間（ダミー用）
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
        # 超ざっくり速度: 徒歩=4.5km/h, 車=30km/h
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


def get_adapter() -> Tuple[str, BaseRouteAdapter]:
    provider = (getenv("ROUTE_PROVIDER") or "dummy").lower()
    # 実装予定:
    # if provider == "mapbox": return provider, MapboxAdapter(getenv("MAPBOX_TOKEN"))
    # if provider == "google": return provider, GoogleRoutesAdapter(getenv("GOOGLE_API_KEY"))
    return provider, DummyAdapter()


def build_route(mode: Mode, origin: Point, destinations: List[Point]) -> Dict:
    provider, adapter = get_adapter()
    legs = []
    current = origin
    for dest in destinations:
        leg = adapter.get_leg(mode, current, dest)
        legs.append(leg)
        current = dest
    distance_total = sum(l["distance_m"] for l in legs)
    duration_total = sum(l["duration_s"] for l in legs)
    return {
        "mode": mode,
        "legs": legs,
        "distance_m_total": distance_total,
        "duration_s_total": duration_total,
        "provider": provider,
    }
