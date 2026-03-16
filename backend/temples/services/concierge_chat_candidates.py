from __future__ import annotations

import logging
import math
from typing import Any, Dict, List, Optional

from django.db.models import Q

from temples.models import Shrine
from temples.services.concierge_candidate_utils import (
    _dedupe_candidates,
    _to_float,
)

log = logging.getLogger(__name__)

DEFAULT_LIMIT = 12


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
    a = (math.sin(dphi / 2) ** 2) + (
        math.cos(phi1) * math.cos(phi2) * math.sin(dl / 2) ** 2
    )
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

    # area文字列フィルタは、座標が取れていない時だけ使う
    if area and (lat is None or lng is None):
        qs = qs.filter(
            Q(address__icontains=area)
            | Q(name_jp__icontains=area)
            | Q(name_romaji__icontains=area)
        )

    noisy_shrine_names = [
        "x",
        "x2",
        "noaddr",
        "住所なし神社",
        "test神社",
        "テスト候補神社",
        "テスト神社",
        "テスト神社2",
        "テスト神社-1770895174",
    ]

    qs = qs.exclude(name_jp__in=noisy_shrine_names)
    qs = qs.exclude(name_jp__startswith="テスト")
    qs = qs.exclude(name_jp__istartswith="test")

    qs = qs.select_related("place_ref")
    qs = qs.filter(latitude__isnull=False, longitude__isnull=False)
    qs = qs.exclude(address="")

    # 候補母集団は少し広めに取る
    if hasattr(Shrine, "popular_score"):
        qs = qs.order_by("-popular_score", "id")
    else:
        qs = qs.order_by("id")

    pool_limit = max(limit * 5, 50)
    qs = qs[:pool_limit]

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
                "goriyaku": getattr(s, "goriyaku", None),
                "description": getattr(s, "description", None),
                "astro_tags": getattr(s, "astro_tags", None),
                "astro_elements": getattr(s, "astro_elements", None),
                "astro_priority": getattr(s, "astro_priority", None),
                "goriyaku_tag_ids": list(s.goriyaku_tags.values_list("id", flat=True))
                if hasattr(s, "goriyaku_tags")
                else [],
                "popular_score": getattr(s, "popular_score", None),
            }
        )

    # 座標がある場合は距離優先、ない場合は人気順
    if lat is not None and lng is not None:
        candidates.sort(
            key=lambda c: (
                float(c.get("distance_m") or 1e12),
                -float(c.get("popular_score") or 0),
                str(c.get("name") or ""),
            )
        )
    else:
        candidates.sort(
            key=lambda c: (
                -float(c.get("popular_score") or 0),
                str(c.get("name") or ""),
            )
        )

    candidates = candidates[:limit]
    candidates = _dedupe_candidates(candidates)

    with_pid = sum(1 for c in candidates if c.get("place_id"))
    miss_latlng = sum(
        1 for c in candidates
        if c.get("lat") is None or c.get("lng") is None
    )
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
