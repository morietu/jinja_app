# -*- coding: utf-8 -*-
from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import unicodedata
from hashlib import md5
from math import atan2, cos, radians, sin
from typing import Any, Dict, Optional, Tuple
from urllib.parse import urlencode

import requests
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

from ..models import PlaceRef
from . import google_places  # 低レベルHTTPクライアント（関数型）に統一

req_history = google_places.req_history

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

logger = logging.getLogger(__name__)

DEBUG_PLACES_RANKING = os.getenv("PLACES_DEBUG", "0").lower() in {"1", "true", "on"}


def _dbg(msg: str, **kv):
    if DEBUG_PLACES_RANKING:
        logger.info("places.rank %s | %s", msg, kv)


# 環境変数からTTL
DEFAULT_TTL = int(os.getenv("PLACES_CACHE_TTL_SECONDS", "90"))
PHOTO_TTL = int(os.getenv("PLACES_PHOTO_CACHE_TTL_SECONDS", "86400"))

__all__ = [
    # 新API
    "places_text_search",
    "places_nearby_search",
    "places_details",
    "places_photo",
    "get_or_sync_place",
    "build_photo_params",
    # 旧API互換シム
    "text_search",
    "nearby_search",
    "details",
    "photo",
    "text_search_first",
]


class PlacesService:
    BASE = "https://maps.googleapis.com/maps/api/place"

    # fields を "a,b,c" に正規化
    def _join_fields(fields):
        if not fields:
            return None
        if isinstance(fields, str):
            return fields
        return ",".join(fields)

    def text_search(self, lat: float, lng: float, query: str, radius: int = 7000):
        """周辺の神社候補を取得（Text Search）。"""
        if not GOOGLE_MAPS_API_KEY:
            return []  # キー未設定なら空
        url = f"{self.BASE}/textsearch/json"
        params = {
            "query": query,
            "location": f"{lat},{lng}",
            "radius": radius,
            "language": "ja",
            "key": GOOGLE_MAPS_API_KEY,
        }
        r = requests.get(url, params=params, timeout=10)
        r.raise_for_status()
        data = r.json()
        return data.get("results", [])


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
    """
    Nearby Search（キャッシュ付）
    - 神社系のみ抽出
    - 近い順＋マッチ度で並べ替え（距離→マッチ度→rating→件数）
    - 完全一致（キーワード）があれば先頭へ。Nearbyに無ければText Searchから注入（半径+20%まで）
    - Nearbyが空のときは Text Search にフォールバック（同じ整列/注入）
    """
    params = dict(params or {})
    params.setdefault("language", _lang_or_default(params.get("language")))
    payload = {"endpoint": "nearby_search", **_norm_params(params)}

    def fetch():
        return _wrap_call(google_places.nearby_search, params)

    data, _ = _get_or_set("search", payload, fetch, DEFAULT_TTL)

    # ---- ここから整形（cachedでも毎回同じ処理） --------------------
    keyword = params.get("keyword") or "神社"
    pagetoken = params.get("pagetoken")
    language = params.get("language")
    radius = int(params.get("radius") or 1500)

    try:
        center = (
            (float(params["lat"]), float(params["lng"]))
            if (params.get("lat") is not None and params.get("lng") is not None)
            else None
        )
    except Exception:
        center = None

    raw = (data or {}).get("results") or []
    filtered = [r for r in raw if _is_shinto_shrine_row(r)]
    # 取得状況のログ
    _dbg(
        "nearby.fetch",
        keyword=keyword,
        lat=params.get("lat"),
        lng=params.get("lng"),
        radius=radius,
        pagetoken=bool(pagetoken),
        raw=len(raw),
        filtered=len(filtered),
    )

    # 近い順＋マッチ度の並べ替え
    sorted_results = _sort_results_for_query(filtered, keyword, center=center)
    # リスト内に完全一致があれば先頭へ
    sorted_results = _ensure_exact_on_top(sorted_results, keyword)

    # 上位プレビュー（距離/マッチ度など）
    if center is not None:
        preview = []
        for r in sorted_results[:5]:
            dist = None
            if r.get("lat") is not None and r.get("lng") is not None:
                dist = int(_haversine_m(center, (float(r["lat"]), float(r["lng"]))))
            preview.append(
                {
                    "name": r.get("name"),
                    "d_m": dist,
                    "match": _keyword_match_score(r.get("name"), keyword),
                    "rating": r.get("rating"),
                    "reviews": r.get("user_ratings_total"),
                }
            )
        _dbg("rank.top5", items=preview)

    # 完全一致が無ければ Text Search から1件注入
    if not pagetoken and center is not None:
        key = _norm(keyword)
        has_exact = any(_norm(r.get("name")) == key for r in sorted_results)
        if not has_exact:
            hit = _find_exact_from_text_nearby(
                keyword, center=center, radius_m=radius, language=language
            )
            if hit and _is_shinto_shrine_row(hit):
                _dbg("inject.exact_text", name=hit.get("name"), pid=hit.get("place_id"))
                pid = hit.get("place_id")
                sorted_results = [x for x in sorted_results if x.get("place_id") != pid]
                sorted_results.insert(0, hit)
            else:
                _dbg("inject.miss", keyword=keyword)
    # Nearby が空なら Text Search にフォールバック
    if not sorted_results and not pagetoken:
        q_bias = keyword if ("神社" in keyword) else f"{keyword} 神社"
        _dbg("fallback.text_search", q=q_bias)
        ts_params = {"q": q_bias, "language": _lang_or_default(language)}
        if center is not None:
            ts_params.update({"lat": center[0], "lng": center[1], "radius": radius})
        _dbg(
            "fallback.text_search",
            **{k: ts_params[k] for k in ("q", "lat", "lng", "radius") if k in ts_params},
        )

        ts = places_text_search(ts_params)

        ts_results = [r for r in (ts.get("results") or []) if _is_shinto_shrine_row(r)]
        ts_results = _sort_results_for_query(ts_results, keyword, center=center)
        ts_results = _ensure_exact_on_top(ts_results, keyword)

        if center is not None:
            key = _norm(keyword)
            if not any(_norm(r.get("name")) == key for r in ts_results):
                hit = _find_exact_from_text_nearby(
                    keyword, center=center, radius_m=radius, language=language
                )
                if hit and _is_shinto_shrine_row(hit):
                    _dbg(
                        "inject.exact_text",
                        name=hit.get("name"),
                        pid=hit.get("place_id"),
                    )
                    pid = hit.get("place_id")
                    ts_results = [x for x in ts_results if x.get("place_id") != pid]
                    ts_results.insert(0, hit)
                else:
                    _dbg("inject.miss", keyword=keyword)

        ts["results"] = ts_results
        return ts

    data["results"] = sorted_results
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
        return google_places.build_photo_params(
            photo_reference, maxwidth=maxwidth, maxheight=maxheight
        )
    return {
        "photo_reference": photo_reference,
        "maxwidth": maxwidth,
        "maxheight": maxheight,
    }


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


def _join_fields(fields):
    if not fields:
        return None
    if isinstance(fields, str):
        return fields
    return ",".join(fields)


def find_place(
    *,
    input: str,
    inputtype: str,
    language: str = "ja",
    locationbias: Optional[str] = None,
    fields: Optional[str | list] = None,
    sessiontoken: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Find Place from Text の薄いラッパ。
    - 低レイヤ: google_places.find_place_text(query, ...)
    - 戻りは Google 本家に合わせて `candidates` キーを付与する（tests/concierge が期待）
    """
    params = {
        "language": language,
        "locationbias": locationbias,
        "fields": _join_fields(fields),
        "sessiontoken": sessiontoken,
    }
    # None は渡さない
    params = {k: v for k, v in params.items() if v is not None}
    # 低レイヤは第1引数にクエリ、他はキーワード引数
    data = _wrap_call(google_places.find_place_text, input, **params)
    # `results` → `candidates` へ正規化
    if "candidates" not in data:
        data = dict(data)
        data["candidates"] = data.get("results", [])
    return data


# details は旧API互換シムの形に一本化（places_details を呼ぶ）
def details(place_id=None, params=None, **kwargs):
    """旧API互換: temples.services.places.details(place_id, params)"""
    if place_id is None:
        place_id = kwargs.get("place_id")
    p = params or {
        "language": kwargs.get("language"),
        "fields": _join_fields(kwargs.get("fields")),
    }
    p = {k: p.get(k) for k in ("language", "fields") if p.get(k) is not None}
    return places_details(place_id, p)


# 既存の text_search / nearby_search をメソッド化した薄いクライアント
class _PlacesClient:
    def find_place(self, **kw):
        return find_place(**kw)

    def details(self, **kw):
        return details(**kw)

    def text_search(self, **kw):
        return text_search(**kw)  # ← 既存関数名に合わせて

    def nearby_search(self, **kw):
        return nearby_search(**kw)  # ← 既存関数名に合わせて


# シングルトンをエクスポート（concierge から import される）
places_client = _PlacesClient()


def photo(photo_reference=None, maxwidth=800, **kwargs):
    """旧API互換: temples.services.places.photo(...)"""
    ref = photo_reference or kwargs.get("photo_reference") or kwargs.get("ref")
    mw = kwargs.get("maxwidth", maxwidth) or maxwidth
    return places_photo(ref, mw)


def _places_key(*parts: str) -> str:
    raw = ":".join("" if p is None else str(p) for p in parts)
    digest = md5(raw.encode("utf-8")).hexdigest()
    return f"{settings.CACHE_KEY_PREFIX}places:{digest}"


def _build_photo_url_simple(
    photo_reference: Optional[str], *, maxwidth: int = 800
) -> Optional[str]:
    """Photo プロキシのURLを組み立て（/api/places/photo/ 経由）"""
    if not photo_reference:
        return None
    params = build_photo_params(photo_reference, maxwidth=maxwidth)
    # None はクエリに含めない
    params = {k: v for k, v in params.items() if v is not None}
    return f"/api/places/photo/?{urlencode(params)}"


# 末尾の text_search_first を置き換え
# ファイル内の下の方にある text_search_first を置き換え
def text_search_first(q: str, language: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    正規化済み TextSearch の最初の『神社だけ』から1件返す。
    address / location / photo_url を整形。なければ詳細で補完。
    """

    def _is_shinto(r: Dict[str, Any]) -> bool:
        types = set(r.get("types") or [])
        name = r.get("name") or ""
        if "buddhist_temple" in types:
            return False
        return ("shinto_shrine" in types) or ("神社" in name)

    data = places_text_search({"q": q, "language": _lang_or_default(language)})
    results = [r for r in ((data or {}).get("results") or []) if _is_shinto(r)]
    if not results:
        return None

    r0 = results[0]
    addr = r0.get("address") or r0.get("formatted_address") or r0.get("vicinity")
    lat, lng = r0.get("lat"), r0.get("lng")
    photo_ref = r0.get("photo_reference")

    out = {
        "place_id": r0.get("place_id"),
        "address": addr,
        "formatted_address": addr,
        "photo_url": (_build_photo_url_simple(photo_ref, maxwidth=800) if photo_ref else None),
        "location": ({"lat": lat, "lng": lng} if (lat is not None and lng is not None) else None),
    }

    # 不足は Details で補完
    if out["address"] is None or out["location"] is None:
        try:
            det = places_details(out["place_id"], {"language": _lang_or_default(language)})
            addr2 = det.get("formatted_address") or det.get("vicinity")
            if out["address"] is None and addr2:
                out["address"] = addr2
                out["formatted_address"] = addr2
            loc2 = (det.get("geometry") or {}).get("location") or {}
            la2, ln2 = loc2.get("lat"), loc2.get("lng")
            if out["location"] is None and la2 is not None and ln2 is not None:
                out["location"] = {"lat": la2, "lng": ln2}
        except Exception:
            pass
    return out


# ---- ranking / filtering helpers ---------------------------------
def _norm(s: Optional[str]) -> str:
    """日本語名の簡易正規化（NFKC→小文字→記号/空白除去）。"""
    if not s:
        return ""
    s = unicodedata.normalize("NFKC", str(s)).casefold()
    s = re.sub(r"[ \u3000\-\.\,，。/／\(\)（）「」『』【】\[\]~～・]+", "", s)
    return s


def _haversine_m(a: Tuple[float, float], b: Tuple[float, float]) -> float:
    """(lat,lng)×2 → 距離[m]"""
    (lat1, lng1), (lat2, lng2) = a, b
    R = 6371000.0
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    x = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return 2 * R * atan2(x**0.5, (1 - x) ** 0.5)


def _keyword_match_score(name: Optional[str], keyword: Optional[str]) -> float:
    """
    簡易マッチ度。完全一致>前方一致>部分一致>それ以外。
    """
    n, k = _norm(name), _norm(keyword)
    if not k or not n:
        return 0.0
    if n == k:
        return 1.0
    if n.startswith(k):
        return 0.8
    if k in n:
        return 0.6
    return 0.0


def _is_shinto_shrine_row(r: Dict[str, Any]) -> bool:
    """
    神社系のみ通す（buddhist_temple は除外）。
    低レイヤーの正規化結果（types/name）がある前提。
    """
    types = set(r.get("types") or [])
    name = r.get("name") or ""
    if "buddhist_temple" in types:
        return False
    return ("shinto_shrine" in types) or ("神社" in name)


def _sort_results_for_query(
    results: list, keyword: Optional[str], *, center: Optional[Tuple[float, float]]
) -> list:
    """
    並び順：距離(昇順) → マッチ度(降順) → rating(降順) → 口コミ件数(降順)
    """

    def keyer(r: Dict[str, Any]):
        # 距離
        if center is not None and r.get("lat") is not None and r.get("lng") is not None:
            d = _haversine_m(center, (float(r["lat"]), float(r["lng"])))
        else:
            d = 10**12  # centerがない/座標欠落は最下位へ
        match = _keyword_match_score(r.get("name"), keyword)
        rating = float(r.get("rating") or 0.0)
        cnt = int(r.get("user_ratings_total") or 0)
        return (d, -match, -rating, -cnt)

    return sorted(results or [], key=keyer)


def _ensure_exact_on_top(results: list, keyword: Optional[str]) -> list:
    """リスト内に完全一致があれば先頭へ（安定移動）。"""
    key = _norm(keyword)
    if not key:
        return results
    for i, r in enumerate(results or []):
        if _norm(r.get("name")) == key:
            return [r] + [x for j, x in enumerate(results) if j != i]
    return results


def _find_exact_from_text_nearby(
    keyword: str,
    *,
    center: Optional[Tuple[float, float]],
    radius_m: int,
    language: Optional[str],
) -> Optional[Dict[str, Any]]:
    """
    まず Find Place from Text（locationbias 付き）で指名ヒットを探す。
    見つからなければ Text Search（半径+40%）でフォールバック。
    一致条件：完全一致 > 前方一致 > 部分一致。距離は +40% まで許容。
    """
    lang = _lang_or_default(language)

    def _ok_and_dist(r: Dict[str, Any], tgt_norm: str) -> Optional[float]:
        n = _norm(r.get("name"))
        if not (n == tgt_norm or n.startswith(tgt_norm) or tgt_norm in n):
            return None
        if center is None or r.get("lat") is None or r.get("lng") is None:
            return 0.0
        d = _haversine_m(center, (float(r["lat"]), float(r["lng"])))
        return d if d <= radius_m * 1.4 else None

    tgt = _norm(keyword)

    # ---- 1) Find Place from Text を優先（より指名性が高い）
    try:
        locationbias = None
        if center is not None:
            locationbias = f"circle:{int(radius_m * 1.4)}@{center[0]},{center[1]}"

        fp = _wrap_call(
            google_places.find_place_text,
            keyword,
            language=lang,
            locationbias=locationbias,
            fields="place_id,name,geometry,formatted_address,types,photos,opening_hours,icon",
        )
        candidates = fp.get("results") or []
        _dbg("inject.findplace.candidates", n=len(candidates))

        hits: list[Tuple[float, Dict[str, Any]]] = []
        for r in candidates:
            d = _ok_and_dist(r, tgt)
            if d is not None:
                hits.append((d, r))

        if hits:
            hits.sort(key=lambda x: x[0])
            best = hits[0][1]
            _dbg(
                "inject.findplace.hit",
                name=best.get("name"),
                place_id=best.get("place_id"),
            )
            return best
        else:
            _dbg("inject.findplace.miss", keyword=keyword)
    except Exception as e:
        _dbg("inject.findplace.error", err=str(e))

    # ---- 2) フォールバック: Text Search（半径+40%）
    ts_params = {"q": keyword, "language": lang}
    if center is not None:
        ts_params.update(
            {
                "lat": center[0],
                "lng": center[1],
                "radius": int(radius_m * 1.4),
            }
        )
    _dbg("inject.ts.query", **ts_params)

    ts = places_text_search(ts_params)
    candidates = ts.get("results") or []
    _dbg("inject.ts.candidates", n=len(candidates))

    hits: list[Tuple[float, Dict[str, Any]]] = []
    for r in candidates:
        d = _ok_and_dist(r, tgt)
        if d is not None:
            hits.append((d, r))

    if not hits:
        _dbg("inject.miss", keyword=keyword)
        return None

    hits.sort(key=lambda x: x[0])
    best = hits[0][1]
    _dbg("inject.hit", name=best.get("name"), place_id=best.get("place_id"))
    return best


def findplacefromtext(*, input, language=None, locationbias=None, fields=None):
    """
    Google Places API: Find Place From Text
    https://maps.googleapis.com/maps/api/place/findplacefromtext/json
    """
    url = "https://maps.googleapis.com/maps/api/place/findplacefromtext/json"
    params = {
        "key": settings.GOOGLE_MAPS_API_KEY,
        "input": input,
        "inputtype": "textquery",
    }
    if language:
        params["language"] = language
    if locationbias:
        params["locationbias"] = locationbias
    if fields:
        params["fields"] = fields

    _log_upstream("findplacefromtext", url, params)  # 既存と同じログ様式
    resp = requests.get(url, params=params, timeout=_TIMEOUT)
    resp.raise_for_status()
    return resp.json()
