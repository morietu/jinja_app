import os
from typing import Dict, Any, Optional
import requests
from django.utils import timezone

from ..models import PlaceRef

PLACES_BASE = "https://maps.googleapis.com/maps/api/place"
API_KEY = os.environ.get("GOOGLE_PLACES_API_KEY", "")


class PlacesError(RuntimeError):
    pass


def _get(url: str, params: Dict[str, Any]) -> Dict[str, Any]:
    if not API_KEY:
        raise PlacesError("GOOGLE_PLACES_API_KEY is not set")
    params = {**params, "key": API_KEY}
    r = requests.get(url, params=params, timeout=10)
    r.raise_for_status()
    j = r.json()
    status = j.get("status")
    if status not in ("OK", "ZERO_RESULTS"):
        msg = j.get("error_message") or status or "UNKNOWN_ERROR"
        raise PlacesError(f"Places API error: {msg}")
    return j


def text_search(query: str, lat: Optional[float] = None, lng: Optional[float] = None) -> Dict[str, Any]:
    params: Dict[str, Any] = {"query": query, "language": "ja"}
    if lat is not None and lng is not None:
        params["location"] = f"{lat},{lng}"
        params["radius"] = 4000  # 4km くらい
    return _get(f"{PLACES_BASE}/textsearch/json", params)


def details(place_id: str, fields: Optional[str] = None) -> Dict[str, Any]:
    params: Dict[str, Any] = {"place_id": place_id, "language": "ja"}
    if fields:
        params["fields"] = fields
    return _get(f"{PLACES_BASE}/details/json", params)


def get_or_sync_place(place_id: str) -> PlaceRef:
    # 既存があって24h以内ならキャッシュを返す
    rec = PlaceRef.objects.filter(pk=place_id).first()
    if rec and rec.synced_at and (timezone.now() - rec.synced_at).total_seconds() < 86400:
        return rec

    j = details(place_id, fields="place_id,name,formatted_address,geometry")
    result = j.get("result", {})
    loc = ((result.get("geometry") or {}).get("location") or {})

    defaults = {
        "name": result.get("name") or "",
        "address": result.get("formatted_address") or "",
        "latitude": loc.get("lat"),
        "longitude": loc.get("lng"),
        "snapshot_json": result,
        "synced_at": timezone.now(),
    }
    rec, _ = PlaceRef.objects.update_or_create(place_id=place_id, defaults=defaults)
    return rec
