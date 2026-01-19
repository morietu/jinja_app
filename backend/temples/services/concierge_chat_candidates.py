# backend/temples/services/concierge_chat_candidates.py
from __future__ import annotations

from typing import Any, Dict, List, Optional

from django.db.models import Q

from temples.models import Shrine

import math


DEFAULT_LIMIT = 12


def _distance_m(
    lat1: Optional[float],
    lng1: Optional[float],
    lat2: Optional[float],
    lng2: Optional[float],
) -> Optional[int]:
    """
    Haversine 距離（m）
    """
    if None in (lat1, lng1, lat2, lng2):
        return None

    r = 6371000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)

    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dl / 2) ** 2
    )
    return int(2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a)))


def build_chat_candidates(
    *,
    goriyaku_tag_ids: Optional[List[int]] = None,
    area: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    limit: int = DEFAULT_LIMIT,
) -> List[Dict[str, Any]]:
    """
    concierge/chat 用 candidates 生成（LLM 非依存）

    設計方針:
    - DBだけで必ず返す
    - goriyaku / area は「緩く」効かせる
    - 最悪でも limit 件は返す
    """

    qs = Shrine.objects.all()

    # --- ご利益タグで絞る（あれば） ---
    if goriyaku_tag_ids:
        qs = qs.filter(goriyaku_tags__id__in=goriyaku_tag_ids).distinct()

    # --- エリア文字列での緩い絞り込み ---
    if area:
        qs = qs.filter(
            Q(address__icontains=area)
            | Q(name_jp__icontains=area)
            | Q(name__icontains=area)
        )

    # --- 並び順 ---
    if hasattr(Shrine, "popular_score"):
        qs = qs.order_by("-popular_score", "id")
    else:
        qs = qs.order_by("id")

    qs = qs[:limit]

    candidates: List[Dict[str, Any]] = []

    for s in qs:
        dist = _distance_m(lat, lng, s.latitude, s.longitude)

        candidates.append(
            {
                "id": s.id,
                "name": s.name_jp or s.name,
                "address": s.address,
                "lat": s.latitude,
                "lng": s.longitude,
                "distance_m": dist,
                # 後段（filter / score）用
                "goriyaku_tag_ids": list(
                    s.goriyaku_tags.values_list("id", flat=True)
                )
                if hasattr(s, "goriyaku_tags")
                else [],
                "popular_score": getattr(s, "popular_score", None),
            }
        )

    return candidates
