# backend/temples/llm/tools/db_search.py
from __future__ import annotations

from math import asin, cos, radians, sin, sqrt
from typing import Any, Dict, List, Sequence

from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import Distance as DistanceMeasure
from django.db.models import QuerySet

from temples.models import Shrine

JsonDict = Dict[str, Any]


def _hav_m(lat1: float, lon1: float, lat2: float, lon2: float) -> int:
    """ハバースイン距離（メートル）"""
    R = 6371000.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return int(2 * R * asin(sqrt(a)))


def _to_meters(value: Any) -> float:
    """
    Distance か数値っぽいものを、m 単位の float に正規化する。
    Django の ORM annotate の型推論を mypy が理解できないので、
    ここで安全にハンドリングする。
    """
    if isinstance(value, DistanceMeasure):
        return float(value.m)
    if isinstance(value, (int, float)):
        return float(value)
    return 0.0


def search_db_shrines(
    lat: float,
    lng: float,
    goriyaku: Sequence[str] | None = None,
    limit: int = 20,
) -> List[JsonDict]:
    """
    DB から近傍の神社候補を距離昇順で取得する。

    - PostGIS 利用パス: geom + Distance を使って DB 側で距離ソート
    - フォールバック: Python 側でハバースイン距離を計算してソート
    """
    qs: QuerySet[Shrine] = Shrine.objects.all()
    if goriyaku:
        for g in goriyaku:
            qs = qs.filter(goriyaku_tags__name__icontains=g)
    qs = qs.distinct()

    out: List[JsonDict] = []

    # --- PostGIS / Distance 利用パス ---
    try:
        point = Point(lng, lat, srid=4326)
        qs = qs.annotate(distance=Distance("geom", point)).order_by("distance")[:limit]

        for s in qs:
            geom = getattr(s, "geom", None)
            if not geom:
                continue

            out.append(
                {
                    "id": s.id,
                    # name_jp があれば優先、なければ name
                    "name": getattr(s, "name_jp", None) or getattr(s, "name", None),
                    "address": getattr(s, "address", None),
                    "lat": geom.y,
                    "lng": geom.x,
                    "place_id": getattr(s, "place_id", None),
                    "distance_m": int(_to_meters(getattr(s, "distance", 0))),
                }
            )

        return out
    except Exception:
        # --- フォールバック: 全件から距離計算（最大 200 件） ---
        out = []
        for s in Shrine.objects.all()[:200]:
            geom = getattr(s, "geom", None)
            if not geom:
                continue

            out.append(
                {
                    "id": s.id,
                    "name": getattr(s, "name_jp", None) or getattr(s, "name", None),
                    "address": getattr(s, "address", None),
                    "lat": geom.y,
                    "lng": geom.x,
                    "place_id": getattr(s, "place_id", None),
                    "distance_m": _hav_m(lat, lng, geom.y, geom.x),
                }
            )

        out.sort(key=lambda x: x["distance_m"])
        return out[:limit]
