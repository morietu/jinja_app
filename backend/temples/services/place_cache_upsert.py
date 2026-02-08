from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Iterable, Optional

from django.db import transaction
from django.utils import timezone

from temples.models import PlaceCache


@dataclass(frozen=True)
class PlaceCacheInput:
    place_id: str
    name: str = ""
    address: str = ""
    lat: Optional[float] = None
    lng: Optional[float] = None
    rating: Optional[float] = None
    user_ratings_total: Optional[int] = None
    types: Optional[list[str]] = None
    raw: Optional[dict] = None


@transaction.atomic
def upsert_place_cache(i: PlaceCacheInput) -> PlaceCache:
    obj, _created = PlaceCache.objects.update_or_create(
        place_id=i.place_id,
        defaults={
            "name": i.name or "",
            "address": i.address or "",
            "lat": i.lat,
            "lng": i.lng,
            "rating": i.rating,
            "user_ratings_total": i.user_ratings_total,
            "types": i.types or [],
            "raw": i.raw or {},
            # fetched_at は auto_now=True なので自動更新される
            "updated_at": timezone.now(),
        },
    )
    return obj


def upsert_place_cache_many(items: Iterable[PlaceCacheInput]) -> int:
    n = 0
    for i in items:
        upsert_place_cache(i)
        n += 1
    return n
