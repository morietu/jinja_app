from typing import List, Dict, Any
from math import radians, sin, cos, asin, sqrt
from django.contrib.gis.geos import Point
from django.contrib.gis.db.models.functions import Distance
from django.db.models import QuerySet
from temples.models import Shrine

def _hav_m(lat1, lon1, lat2, lon2) -> int:
    R = 6371000.0
    dlat = radians(lat2 - lat1); dlon = radians(lon2 - lon1)
    a = sin(dlat/2)**2 + cos(radians(lat1))*cos(radians(lat2))*sin(dlon/2)**2
    return int(2 * R * asin(sqrt(a)))

def search_db_shrines(lat: float, lng: float, goriyaku=None, limit: int = 20) -> List[Dict[str, Any]]:
    """DBから近傍候補を距離昇順で取得。PostGISが未セットでも落ちないようにフォールバック。"""
    goriyaku = goriyaku or []
    qs: QuerySet = Shrine.objects.all()
    for g in goriyaku:
        qs = qs.filter(goriyaku_tags__name__icontains=g)
    qs = qs.distinct()

    out: List[Dict[str, Any]] = []
    try:
        point = Point(lng, lat, srid=4326)
        qs = qs.annotate(distance=Distance("geom", point)).order_by("distance")[:limit]
        for s in qs:
            if not getattr(s, "geom", None): continue
            out.append({
                "id": s.id,
                "name": s.name,
                "address": getattr(s, "address", None),
                "lat": s.geom.y,
                "lng": s.geom.x,
                "place_id": getattr(s, "place_id", None),
                "distance_m": int(getattr(s, "distance", 0).m),
            })
        return out
    except Exception:
        # フォールバック：全件からハバースイン距離計算
        for s in Shrine.objects.all()[:200]:
            if not getattr(s, "geom", None): continue
            out.append({
                "id": s.id,
                "name": s.name,
                "address": getattr(s, "address", None),
                "lat": s.geom.y,
                "lng": s.geom.x,
                "place_id": getattr(s, "place_id", None),
                "distance_m": _hav_m(lat, lng, s.geom.y, s.geom.x),
            })
        return sorted(out, key=lambda x: x["distance_m"])[:limit]
