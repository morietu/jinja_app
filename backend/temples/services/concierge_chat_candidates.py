# backend/temples/services/concierge_chat_candidates.py
from __future__ import annotations

from typing import Any, Dict, List, Optional
import math
import logging

from django.db.models import Q
from temples.models import Shrine

log = logging.getLogger(__name__)

DEFAULT_LIMIT = 12


def _to_float(v: Any) -> Optional[float]:
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        s = v.strip()
        if not s:
            return None
        try:
            return float(s)
        except Exception:
            return None
    return None


def _distance_m(
    lat1: Optional[float],
    lng1: Optional[float],
    lat2: Optional[float],
    lng2: Optional[float],
) -> Optional[int]:
    lat1f = _to_float(lat1)
    lng1f = _to_float(lng1)
    lat2f = _to_float(lat2)
    lng2f = _to_float(lng2)
    if None in (lat1f, lng1f, lat2f, lng2f):
        return None

    r = 6371000
    phi1 = math.radians(lat1f)
    phi2 = math.radians(lat2f)
    dphi = math.radians(lat2f - lat1f)
    dl = math.radians(lng2f - lng1f)
    a = (math.sin(dphi / 2) ** 2) + (math.cos(phi1) * math.cos(phi2) * math.sin(dl / 2) ** 2)
    return int(2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a)))


def build_chat_candidates(
    *,
    goriyaku_tag_ids: Optional[List[int]] = None,
    area: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    limit: int = DEFAULT_LIMIT,
    trace_id: str | None = None,
) -> List[Dict[str, Any]]:
    qs = Shrine.objects.all()

    if goriyaku_tag_ids:
        qs = qs.filter(goriyaku_tags__id__in=goriyaku_tag_ids).distinct()

    if area:
        qs = qs.filter(
            Q(address__icontains=area)
            | Q(name_jp__icontains=area)
            | Q(name_romaji__icontains=area)
        )

    qs = qs.select_related("place_ref")

    if hasattr(Shrine, "popular_score"):
        qs = qs.order_by("-popular_score", "id")
    else:
        qs = qs.order_by("id")

    qs = qs[:limit]

    candidates: List[Dict[str, Any]] = []
    for s in qs:
        dist = _distance_m(lat, lng, s.latitude, s.longitude)

        pref = getattr(s, "place_ref", None)
        place_id = getattr(pref, "place_id", None) if pref else None

        candidates.append(
            {
                "id": s.id,
                "shrine_id": s.id,
                "place_id": place_id,
                "name": s.name_jp or s.name_romaji,
                "address": s.address,
                "lat": s.latitude,
                "lng": s.longitude,
                "distance_m": dist,
                "goriyaku_tag_ids": list(s.goriyaku_tags.values_list("id", flat=True))
                if hasattr(s, "goriyaku_tags")
                else [],
                "popular_score": getattr(s, "popular_score", None),
            }
        )

    with_pid = sum(1 for c in candidates if c.get("place_id"))
    miss_latlng = sum(1 for c in candidates if c.get("lat") is None or c.get("lng") is None)
    dist_none = sum(1 for c in candidates if c.get("distance_m") is None)

    log.info(
        "[svc/chat_candidates] trace=%s count=%d with_place_id=%d miss_latlng=%d dist_none=%d "
        "area=%r goriyaku=%s latlng_in=%s/%s limit=%d",
        trace_id,
        len(candidates),
        with_pid,
        miss_latlng,
        dist_none,
        (area or "")[:20] if isinstance(area, str) else area,
        "Y" if goriyaku_tag_ids else "N",
        "Y" if lat is not None else "N",
        "Y" if lng is not None else "N",
        limit,
    )

    return candidates
