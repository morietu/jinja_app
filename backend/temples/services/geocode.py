import hashlib
import json
import time
from urllib.parse import urlencode

import requests
from django.conf import settings
from django.core.cache import cache

TTL = int(getattr(settings, "GEOCODE_CACHE_TTL_S", 60 * 60 * 24 * 30))
RATE = int(getattr(settings, "GEOCODE_RATE_PER_MIN", 60))
WINDOW = 60
_calls = []


def _allow() -> bool:
    now = time.time()
    while _calls and now - _calls[0] > WINDOW:
        _calls.pop(0)
    if len(_calls) >= RATE:
        return False
    _calls.append(now)
    return True


def _ck(prefix: str, payload: dict) -> str:
    h = hashlib.sha1(json.dumps(payload, sort_keys=True).encode()).hexdigest()
    return f"{prefix}:{h}"


def _ua_headers():
    email = getattr(settings, "NOMINATIM_EMAIL", None) or "unknown@example.com"
    return {"User-Agent": f"jinja-app/1.0 ({email})"}


def geocode_search(q: str, limit: int = 5, lang: str = "ja"):
    payload = {"q": q.strip(), "limit": int(limit), "lang": lang}
    ckey = _ck("geocode:search", payload)
    if hit := cache.get(ckey):
        return {"items": hit, "cached": True, "provider": "nominatim"}
    if not _allow():
        return {"items": [], "cached": False, "provider": "throttled"}

    base = getattr(settings, "NOMINATIM_BASE", "https://nominatim.openstreetmap.org").rstrip("/")
    params = {
        "q": payload["q"],
        "format": "jsonv2",
        "addressdetails": 1,
        "limit": payload["limit"],
        "accept-language": lang,
    }
    url = f"{base}/search?{urlencode(params)}"
    r = requests.get(url, headers=_ua_headers(), timeout=10)
    r.raise_for_status()
    js = r.json()

    items = [
        {
            "place_id": str(it.get("place_id")),
            "name": it.get("display_name"),
            "lat": float(it.get("lat")),
            "lng": float(it.get("lon")),
            "class": it.get("class"),
            "type": it.get("type"),
            "address": it.get("address", {}),
        }
        for it in js
    ]
    cache.set(ckey, items, TTL)
    return {"items": items, "cached": False, "provider": "nominatim"}


def geocode_reverse(lat: float, lng: float, lang: str = "ja"):
    payload = {"lat": float(lat), "lng": float(lng), "lang": lang}
    ckey = _ck("geocode:reverse", payload)
    if hit := cache.get(ckey):
        return {"item": hit, "cached": True, "provider": "nominatim"}
    if not _allow():
        return {"item": None, "cached": False, "provider": "throttled"}

    base = getattr(settings, "NOMINATIM_BASE", "https://nominatim.openstreetmap.org").rstrip("/")
    params = {
        "lat": payload["lat"],
        "lon": payload["lng"],
        "format": "jsonv2",
        "addressdetails": 1,
        "accept-language": lang,
    }
    url = f"{base}/reverse?{urlencode(params)}"
    r = requests.get(url, headers=_ua_headers(), timeout=10)
    r.raise_for_status()
    it = r.json()
    item = {
        "place_id": str(it.get("place_id")),
        "name": it.get("display_name"),
        "lat": float(it.get("lat")),
        "lng": float(it.get("lon")),
        "address": it.get("address", {}),
    }
    cache.set(ckey, item, TTL)
    return {"item": item, "cached": False, "provider": "nominatim"}
