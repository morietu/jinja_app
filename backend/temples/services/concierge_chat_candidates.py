# backend/temples/services/concierge_chat_candidates.py
from __future__ import annotations

from typing import Any, Dict, List, Optional

import math
from django.db.models import Q

from temples.models import Shrine


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
    """
    Haversine 距離（m）
    - 入力が str でも安全に扱う（CIの契約テスト用 + 呼び出し元差異吸収）
    """
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
          | Q(name_romaji__icontains=area)
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
                "name": s.name_jp or s.name_romaji,  # ✅ s.name は存在しない
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

    return candidates
