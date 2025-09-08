# -*- coding: utf-8 -*-
from __future__ import annotations

import os
import json
import hashlib
import logging
from typing import Dict, Any, Tuple, Optional

from hashlib import md5
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

from ..models import PlaceRef
from . import google_places  # 低レベルHTTPクライアント（関数型）に統一

logger = logging.getLogger(__name__)

# 環境変数からTTL
DEFAULT_TTL = int(os.getenv("PLACES_CACHE_TTL_SECONDS", "90"))
PHOTO_TTL   = int(os.getenv("PLACES_PHOTO_CACHE_TTL_SECONDS", "86400"))

__all__ = [
    # 新API
    "places_text_search", "places_nearby_search", "places_details", "places_photo",
    "get_or_sync_place", "build_photo_params",
    # 旧API互換シム
    "text_search", "nearby_search", "details", "photo",
]

# ----------------------------
# 内部ユーティリティ
# ----------------------------
def _cache_key(ns: str, payload: Dict[str, Any]) -> str:
    s = json.dumps(payload, sort_keys=True, ensure_ascii=False)
    h = hashlib.sha256(s.encode("utf-8")).hexdigest()
    return f"places:{ns}:{h}"

def _get_or_set(ns: str, payload: Dict[str, Any], fetcher, ttl: int):
    key = _cache_key(ns, payload)
    cached = cache.get(key)
    if cached is not None:
        return cached, True
    data = fetcher()
    cache.set(key, data, ttl)
    return data, False

class PlacesError(Exception):
    """Places系のアプリ内エラー。status にHTTP相当を入れてビュー側で使う。"""
    def __init__(self, message: str, status: Optional[int] = None):
        super().__init__(message)
        self.status = status

def _wrap_call(fn, *args, **kwargs):
    """低レイヤーの例外を PlacesError に張り替え"""
    try:
        return fn(*args, **kwargs)
    except RuntimeError as e:
        msg = str(e)
        status = 502
        if "INVALID_REQUEST" in msg:
            status = 400
        elif "OVER_QUERY_LIMIT" in msg:
            status = 429
        elif "NOT_FOUND" in msg:
            status = 404
        raise PlacesError(msg, status=status) from e
    except Exception as e:
        raise PlacesError(str(e), status=500) from e

def _lang_or_default(language: Optional[str]) -> str:
    return language or getattr(settings, "GOOGLE_DEFAULT_LANGUAGE", "ja")

def _norm_params(d: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    return {k: v for k, v in (d or {}).items() if v is not None}

# ----------------------------
# パブリックAPI（View から呼ばれる想定）
# ----------------------------
def places_text_search(params: Dict[str, Any]) -> Dict[str, Any]:
    """Text Search（キャッシュ付）"""
    params = dict(params or {})
    params.setdefault("language", _lang_or_default(params.get("language")))
    payload = {"endpoint": "text_search", **_norm_params(params)}

    def fetch():
        return _wrap_call(google_places.text_search, params)

    data, _ = _get_or_set("search", payload, fetch, DEFAULT_TTL)
    return data

def places_nearby_search(params: Dict[str, Any]) -> Dict[str, Any]:
    """Nearby Search（キャッシュ付）"""
    params = dict(params or {})
    params.setdefault("language", _lang_or_default(params.get("language")))
    payload = {"endpoint": "nearby_search", **_norm_params(params)}

    def fetch():
        return _wrap_call(google_places.nearby_search, params)

    data, _ = _get_or_set("search", payload, fetch, DEFAULT_TTL)
    return data

def places_details(place_id: str, params: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Place Details（キャッシュ付）"""
    params = dict(params or {})
    params.setdefault("language", _lang_or_default(params.get("language")))
    payload = {"endpoint": "details", "place_id": place_id, **_norm_params(params)}

    def fetch():
        return _wrap_call(google_places.details, place_id, params)

    data, _ = _get_or_set("details", payload, fetch, DEFAULT_TTL)
    return data

def places_photo(photo_reference: str, maxwidth: int = 800) -> Tuple[bytes, str, int]:
    """
    Photo（キャッシュ付）
    Returns: (content_bytes, content_type, max_age)
    """
    if not photo_reference:
        raise PlacesError("photo_reference is required", status=400)

    payload = {"endpoint": "photo", "ref": photo_reference, "w": maxwidth}

    def fetch():
        content, content_type = _wrap_call(google_places.photo, photo_reference, maxwidth=maxwidth)
        return (content, content_type or "image/jpeg")

    (content, content_type), _ = _get_or_set("photo", payload, fetch, PHOTO_TTL)
    return content, content_type, PHOTO_TTL

# ----------------------------
# 付帯ユースケース（DB同期など）
# ----------------------------
def get_or_sync_place(place_id: str, force: bool = False) -> PlaceRef:
    """Place Details を取得し、PlaceRef を同期（Upsert）"""
    pr: Optional[PlaceRef] = PlaceRef.objects.filter(pk=place_id).first()
    if pr and not force:
        return pr

    result = _wrap_call(google_places.details, place_id, {"language": _lang_or_default(None)})

    name = result.get("name")
    address = result.get("formatted_address") or result.get("vicinity")
    geometry = result.get("geometry") or {}
    loc = geometry.get("location") or {}
    lat = loc.get("lat")
    lng = loc.get("lng")

    pr, _created = PlaceRef.objects.update_or_create(
        pk=place_id,
        defaults={
            "place_id": place_id,
            "name": name,
            "address": address,
            "latitude": lat,
            "longitude": lng,
            "snapshot_json": result,
            "synced_at": timezone.now(),
        },
    )
    return pr

def build_photo_params(
    photo_reference: str,
    maxwidth: Optional[int] = None,
    maxheight: Optional[int] = None,
) -> Dict[str, Any]:
    """フロント等へ署名付きURLを渡す場合の補助（低レイヤー実装に合わせて必要なら実装）"""
    if hasattr(google_places, "build_photo_params"):
        return google_places.build_photo_params(photo_reference, maxwidth=maxwidth, maxheight=maxheight)
    return {"photo_reference": photo_reference, "maxwidth": maxwidth, "maxheight": maxheight}

# ----------------------------
# 旧API互換シム（既存テスト/コードからの import を保護）
# ----------------------------
def text_search(*args, **kwargs):
    """
    旧API互換: temples.services.places.text_search(...)
    dictでもキーワード引数でもOK
    """
    if args and isinstance(args[0], dict):
        params = args[0]
    else:
        params = {
            "q": kwargs.get("q"),
            "lat": kwargs.get("lat"),
            "lng": kwargs.get("lng"),
            "radius": kwargs.get("radius"),
            "type": kwargs.get("type"),
            "opennow": kwargs.get("opennow"),
            "pagetoken": kwargs.get("pagetoken"),
            "language": kwargs.get("language"),
        }
    return places_text_search(_norm_params(params))

def nearby_search(*args, **kwargs):
    """旧API互換: temples.services.places.nearby_search(...)"""
    if args and isinstance(args[0], dict):
        params = args[0]
    else:
        params = {
            "lat": kwargs.get("lat"),
            "lng": kwargs.get("lng"),
            "radius": kwargs.get("radius"),
            "keyword": kwargs.get("keyword"),
            "type": kwargs.get("type"),
            "opennow": kwargs.get("opennow"),
            "pagetoken": kwargs.get("pagetoken"),
            "language": kwargs.get("language"),
        }
    return places_nearby_search(_norm_params(params))

def details(place_id=None, params=None, **kwargs):
    """旧API互換: temples.services.places.details(place_id, params)"""
    if place_id is None:
        place_id = kwargs.get("place_id")
    p = params or {
        "language": kwargs.get("language"),
        "fields": kwargs.get("fields"),
    }
    p = {k: p.get(k) for k in ("language", "fields") if p.get(k) is not None}
    return places_details(place_id, p)

def photo(photo_reference=None, maxwidth=800, **kwargs):
    """旧API互換: temples.services.places.photo(...)"""
    ref = photo_reference or kwargs.get("photo_reference") or kwargs.get("ref")
    mw = kwargs.get("maxwidth", maxwidth) or maxwidth
    return places_photo(ref, mw)

def _places_key(*parts: str) -> str:
    raw = ":".join("" if p is None else str(p) for p in parts)
    digest = md5(raw.encode("utf-8")).hexdigest()
    return f"{settings.CACHE_KEY_PREFIX}places:{digest}"