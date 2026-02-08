# backend/temples/api/views/place_cache.py
from __future__ import annotations

import re
from typing import Any

from django.db.models import Q
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from temples.models import PlaceCache


_CANONICAL_DROP_SUFFIX = re.compile(r"\s*(社務所|銅鳥居|鳥居|遥拝所|分祀|境内社|末社)\s*$")
_CANONICAL_DROP_PARENS = re.compile(r"[（(].*?[）)]")  # （天満宮）みたいなのを落とす


def _canonical_name(name: str) -> str:
    s = (name or "").strip()
    s = _CANONICAL_DROP_PARENS.sub("", s)
    s = _CANONICAL_DROP_SUFFIX.sub("", s)
    s = " ".join(s.split())
    return s


def _parse_int(s: str | None, *, default: int, min_: int, max_: int) -> int:
    try:
        n = int(s) if s is not None else default
    except Exception:
        n = default
    return max(min_, min(n, max_))


def _parse_bool(s: str | None) -> bool:
    return (s or "").strip().lower() in {"1", "true", "yes", "y", "on"}


@api_view(["GET"])
@permission_classes([AllowAny])
def place_cache_list(request):
    """
    GET /api/place-caches/?q=...&limit=...&dedupe=1
    """
    q = (request.query_params.get("q") or "").strip()
    limit = _parse_int(request.query_params.get("limit"), default=20, min_=1, max_=60)
    dedupe = _parse_bool(request.query_params.get("dedupe"))

    qs = PlaceCache.objects.all()

    if q:
        qs = qs.filter(Q(name__icontains=q) | Q(address__icontains=q))

    # 最新順（rows のベース順）
    qs = qs.order_by("-updated_at")

    # values() で取る前に一旦多めに取って Python で dedupe
    rows: list[dict[str, Any]] = list(
        qs.values(
            "place_id",
            "name",
            "address",
            "lat",
            "lng",
            "rating",
            "user_ratings_total",
            "types",
            "updated_at",
        )[: limit * 3]  # dedupe で落ちる分の保険
    )

    def _has_drop_suffix(name: str) -> bool:
        s = (name or "").strip()
        s = _CANONICAL_DROP_PARENS.sub("", s)
        return bool(_CANONICAL_DROP_SUFFIX.search(s))

    def _score_row(r: dict[str, Any]) -> tuple:
        types = set(r.get("types") or [])
        name = r.get("name") or ""

        is_worship = 1 if "place_of_worship" in types else 0
        is_not_suffix = 1 if not _has_drop_suffix(name) else 0

        urt = r.get("user_ratings_total")
        try:
            urt_i = int(urt) if urt is not None else 0
        except Exception:
            urt_i = 0

        rating = r.get("rating")
        try:
            rating_f = float(rating) if rating is not None else 0.0
        except Exception:
            rating_f = 0.0

        updated_at = r.get("updated_at")  # datetime 想定

        # 大きいほど勝つ
        return (is_worship, is_not_suffix, urt_i, rating_f, updated_at)

    if dedupe:
        picked: dict[str, dict[str, Any]] = {}
        for r in rows:
            key = _canonical_name(r.get("name") or "")
            if not key:
                continue

            cur = picked.get(key)
            if cur is None or _score_row(r) > _score_row(cur):
                picked[key] = r

        items = sorted(picked.values(), key=_score_row, reverse=True)[:limit]
    else:
        items = rows[:limit]

    return Response({"results": items, "count": len(items)})
