# backend/temples/services/google_places.py
import logging
import os
import sys
from typing import Any, Dict, List, Optional, Tuple, cast

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

# ===== Request history (tests 用) =====
ReqEntry = Tuple[str, Dict[str, Any]]
req_history: List[ReqEntry] = []

# 可能ならパッケージ側にも同じ参照をエクスポート（失敗しても問題なし）
try:
    import temples.services as _PKG

    _PKG.req_history = req_history
except Exception:
    pass
try:
    from . import places as _PLACES

    _PLACES.req_history = req_history
except Exception:
    pass


def _push_req_history(url: str, params: dict) -> None:
    """APIキーを伏せて履歴に1件追加（tests が読む）。"""
    masked = dict(params or {})
    if "key" in masked:
        masked["key"] = "****"
    req_history.append((url, masked))


# ------------------------------------------------------------
# API キー
# ------------------------------------------------------------
def _resolve_api_key() -> Optional[str]:
    candidates = [
        # settings.*
        getattr(settings, "GOOGLE_PLACES_API_KEY", None),
        getattr(settings, "GOOGLE_MAPS_API_KEY", None),
        getattr(settings, "GOOGLE_API_KEY", None),
        # env
        os.getenv("GOOGLE_PLACES_API_KEY"),
        os.getenv("GOOGLE_MAPS_API_KEY"),
        os.getenv("GOOGLE_API_KEY"),
        os.getenv("MAPS_API_KEY"),
        os.getenv("PLACES_API_KEY"),
    ]
    for k in candidates:
        if not k:
            continue
        k = str(k).strip()
        if k and not k.startswith("${"):  # プレースホルダ弾き
            return k
    return None


# 低レイヤ/クライアント双方が参照
API_KEY: Optional[str] = _resolve_api_key()


# ------------------------------------------------------------
# 高レベルクライアント
# ------------------------------------------------------------
class GooglePlacesClient:
    BASE_URL = "https://maps.googleapis.com/maps/api/place"

    def __init__(self, api_key: Optional[str] = None, timeout: Optional[float] = None):
        self.api_key: str = cast(str, api_key or API_KEY)
        if not self.api_key:
            raise RuntimeError(
                "Google Places API key is not set. "
                "Set GOOGLE_PLACES_API_KEY (or GOOGLE_MAPS_API_KEY)."
            )
        self.timeout = (
            timeout if timeout is not None else float(os.getenv("GOOGLE_PLACES_TIMEOUT", "8.0"))
        )

    def _get(self, path: str, params: Dict[str, Any]) -> requests.Response:
        url = f"{self.BASE_URL}/{path}/json"
        q = {"key": self.api_key, **params}

        _push_req_history(url, q)  # 履歴へ（キーは伏字）

        resp = requests.get(url, params=q, timeout=self.timeout)

        # ログ（キーは伏字）
        try:
            safe_url = resp.url.replace(self.api_key or "", "****")
        except Exception:
            safe_url = "<masked>"
        logger.info("Places upstream[%s] %s", path, safe_url)

        resp.raise_for_status()
        return resp

    @staticmethod
    def _ensure_ok(data: Dict[str, Any]) -> None:
        status = data.get("status")
        # status が None の場合も OK とみなす（モック互換）
        if status in ("OK", "ZERO_RESULTS") or status is None:
            return
        msg = data.get("error_message") or status or "UNKNOWN_ERROR"
        raise RuntimeError(f"Google Places error: {msg}")

    @staticmethod
    def _normalize_result(r: Dict[str, Any]) -> Dict[str, Any]:
        geometry = r.get("geometry") or {}
        loc = geometry.get("location") or {}
        photos = r.get("photos") or []
        first_photo_ref = (photos[0] or {}).get("photo_reference") if photos else None
        return {
            "place_id": r.get("place_id"),
            "name": r.get("name"),
            "address": r.get("formatted_address") or r.get("vicinity"),
            "lat": loc.get("lat"),
            "lng": loc.get("lng"),
            "rating": r.get("rating"),
            "user_ratings_total": r.get("user_ratings_total"),
            "types": r.get("types"),
            "open_now": (r.get("opening_hours") or {}).get("open_now"),
            "photo_reference": first_photo_ref,
            "icon": r.get("icon"),
        }

    def text_search(
        self,
        query: str,
        *,
        location: Optional[str] = None,
        radius: Optional[int] = None,
        pagetoken: Optional[str] = None,
        language: str = "ja",
        region: str = "jp",
        open_now: Optional[bool] = None,
        minprice: Optional[int] = None,
        maxprice: Optional[int] = None,
        type_: Optional[str] = None,
    ) -> Tuple[Dict[str, Any], Optional[str]]:
        # --- テスト時は findplace を使えるよう切替（環境変数） ---
        use_findplace = os.getenv("PLACES_USE_FINDPLACE") == "1" or os.getenv("IS_PYTEST") == "1"
        if use_findplace and not pagetoken:
            fp_params: Dict[str, Any] = {
                "language": language,
                "input": query,
                "inputtype": "textquery",
                "fields": "place_id,formatted_address,geometry,photos,name,rating,user_ratings_total,types,opening_hours,icon",
            }
            if location and radius:
                fp_params["locationbias"] = f"circle:{int(radius)}@{location}"

            data = self._get("findplacefromtext", fp_params).json()
            status = data.get("status")
            if status not in ("OK", "ZERO_RESULTS"):
                logger.error(
                    "Places findplacefromtext error: %s, msg=%s", status, data.get("error_message")
                )
                self._ensure_ok(data)

            results = []
            for c in data.get("candidates", []):
                r = {
                    "place_id": c.get("place_id"),
                    "name": c.get("name"),
                    "formatted_address": c.get("formatted_address"),
                    "geometry": c.get("geometry"),
                    "photos": c.get("photos"),
                    "rating": c.get("rating"),
                    "user_ratings_total": c.get("user_ratings_total"),
                    "types": c.get("types"),
                    "opening_hours": c.get("opening_hours"),
                    "icon": c.get("icon"),
                }
                results.append(self._normalize_result(r))
            return {"results": results, "status": status}, None

        # --- 既存: textsearch ---
        params: Dict[str, Any] = {"language": language, "region": region}
        if pagetoken:
            params["pagetoken"] = pagetoken
        else:
            params["query"] = query
            if location:
                params["location"] = location
            if radius:
                params["radius"] = radius
            if open_now is True:
                params["opennow"] = "true"
            if minprice is not None:
                params["minprice"] = minprice
            if maxprice is not None:
                params["maxprice"] = maxprice
            if type_:
                params["type"] = type_

        data = self._get("textsearch", params).json()
        status = data.get("status") or ("OK" if "candidates" in data else None)
        if status not in ("OK", "ZERO_RESULTS"):
            logger.error(
                "Places findplacefromtext error: %s, msg=%s",
                status,
                data.get("error_message"),
            )
            self._ensure_ok(data)
        results = [self._normalize_result(r) for r in data.get("results", [])]
        return {"results": results, "status": status}, data.get("next_page_token")

    def nearby_search(
        self,
        *,
        location: str,
        radius: int,
        keyword: Optional[str] = None,
        language: str = "ja",
        pagetoken: Optional[str] = None,
        type_: Optional[str] = None,
        opennow: Optional[bool] = None,
    ) -> Tuple[Dict[str, Any], Optional[str]]:
        params: Dict[str, Any] = {"language": language}
        if pagetoken:
            params["pagetoken"] = pagetoken
        else:
            params.update({"location": location, "radius": radius})
            if keyword:
                params["keyword"] = keyword
            if type_:
                params["type"] = type_
            if opennow is True:
                params["opennow"] = "true"

        data = self._get("nearbysearch", params).json()
        status = data.get("status")
        if status not in ("OK", "ZERO_RESULTS"):
            logger.error(
                "Places nearby_search error: %s, msg=%s",
                status,
                data.get("error_message"),
            )
            self._ensure_ok(data)
        results = [self._normalize_result(r) for r in data.get("results", [])]
        return {"results": results, "status": status}, data.get("next_page_token")

    def place_details(
        self,
        place_id: str,
        *,
        language: str = "ja",
        fields: Optional[str] = None,
    ) -> Dict[str, Any]:
        params = {"place_id": place_id, "language": language}
        if fields:
            params["fields"] = fields
        data = self._get("details", params).json()
        if data.get("status") not in ("OK", "ZERO_RESULTS"):
            logger.error(
                "Places details error: %s, msg=%s",
                data.get("status"),
                data.get("error_message"),
            )
            self._ensure_ok(data)
        return data.get("result", {})

    def build_photo_params(
        self,
        photo_reference: str,
        *,
        maxwidth: Optional[int] = 800,
        maxheight: Optional[int] = None,
    ) -> Dict[str, Any]:
        return {
            "key": self.api_key,
            "photoreference": photo_reference,
            **({"maxwidth": int(maxwidth)} if maxwidth else {}),
            **({"maxheight": int(maxheight)} if maxheight else {}),
        }

    def photo(
        self,
        photo_reference: str,
        *,
        maxwidth: Optional[int] = 800,
        maxheight: Optional[int] = None,
    ) -> Tuple[bytes, str]:
        url = f"{self.BASE_URL}/photo"
        params = self.build_photo_params(photo_reference, maxwidth=maxwidth, maxheight=maxheight)
        resp = requests.get(url, params=params, timeout=self.timeout, stream=True)

        # マスクしてログ
        try:
            safe_url = resp.url.replace(self.api_key or "", "****")
        except Exception:
            safe_url = "<masked>"
        logger.info("Places upstream[photo]: %s", safe_url)

        resp.raise_for_status()
        content_type = resp.headers.get("Content-Type", "image/jpeg")
        return resp.content, content_type


# ------------------------------------------------------------
# 低レベル API（tests が直接参照）
# ------------------------------------------------------------
_TIMEOUT = 10


def _log_upstream(kind: str, url: str, params: dict) -> None:
    masked = dict(params or {})
    if "key" in masked:
        masked["key"] = "****"
    qs = "&".join(f"{k}={v}" for k, v in masked.items() if v is not None)
    print(f"Places upstream[{kind}] {url}?{qs}", file=sys.stderr)


def textsearch(
    *,
    query: str,
    language: Optional[str] = None,
    region: Optional[str] = None,
    location: Optional[str] = None,
    radius: Optional[int] = None,
    type: Optional[str] = None,
    pagetoken: Optional[str] = None,
) -> Dict[str, Any]:
    url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
    params = {
        "key": API_KEY,
        "query": query,
        "language": language,
        "region": region,
        "location": location,
        "radius": radius,
        "type": type,
        "pagetoken": pagetoken,
    }
    _log_upstream("textsearch", url, params)
    clean = {k: v for k, v in params.items() if v is not None}
    _push_req_history(url, clean)
    resp = requests.get(url, params=clean, timeout=_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def details(
    *, place_id: str, language: Optional[str] = None, fields: Optional[str] = None
) -> Dict[str, Any]:
    url = "https://maps.googleapis.com/maps/api/place/details/json"
    params = {
        "key": API_KEY,
        "place_id": place_id,
        "language": language,
        "fields": fields,
    }
    _log_upstream("details", url, params)
    clean = {k: v for k, v in params.items() if v is not None}
    _push_req_history(url, clean)
    resp = requests.get(url, params=clean, timeout=_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def findplacefromtext(
    *,
    input: str,
    language: Optional[str] = None,
    locationbias: Optional[str] = None,
    fields: Optional[str] = None,
) -> Dict[str, Any]:
    url = "https://maps.googleapis.com/maps/api/place/findplacefromtext/json"
    params = {
        "key": API_KEY,
        "inputtype": "textquery",
        "input": input,
        "language": language,
        "locationbias": locationbias,
        "fields": fields,
    }
    _log_upstream("findplacefromtext", url, params)
    clean = {k: v for k, v in params.items() if v is not None}
    _push_req_history(url, clean)
    resp = requests.get(url, params=clean, timeout=_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


# 互換エイリアス
def find_place_from_text(**kw):  # noqa: N802
    return findplacefromtext(**kw)


def find_place(**kw):
    return findplacefromtext(**kw)


# ------------------------------------------------------------
# ラッパ（後方互換）
# ------------------------------------------------------------
_client_singleton: Optional[GooglePlacesClient] = None


def _client() -> GooglePlacesClient:
    global _client_singleton
    if _client_singleton is None:
        _client_singleton = GooglePlacesClient()
    return _client_singleton


def text_search(query_or_params=None, **kwargs) -> Dict[str, Any]:
    if isinstance(query_or_params, dict):
        p = dict(query_or_params)
        query = p.pop("q", None) or p.pop("query", "") or ""
        location = p.pop("location", None)
        if not location and p.get("lat") is not None and p.get("lng") is not None:
            location = f"{p.pop('lat')},{p.pop('lng')}"
        pagetoken = p.pop("pagetoken", None)
        language = p.pop("language", "ja")
        region = p.pop("region", "jp")
        open_now = p.pop("opennow", p.pop("open_now", None))
        minprice = p.pop("minprice", None)
        maxprice = p.pop("maxprice", None)
        type_ = p.pop("type", None)
        kwargs.update(p)
        data, _ = _client().text_search(
            query,
            location=location,
            radius=kwargs.pop("radius", None),
            pagetoken=pagetoken,
            language=language,
            region=region,
            open_now=open_now,
            minprice=minprice,
            maxprice=maxprice,
            type_=type_,
            **kwargs,
        )
        return data
    else:
        query = query_or_params if query_or_params is not None else kwargs.pop("query", "")
        data, _ = _client().text_search(query, **kwargs)
        return data


def nearby_search(params_or_none=None, **kwargs) -> Dict[str, Any]:
    if isinstance(params_or_none, dict):
        p = dict(params_or_none)
        location = p.pop("location", None)
        if not location and p.get("lat") is not None and p.get("lng") is not None:
            location = f"{p.pop('lat')},{p.pop('lng')}"
        radius = p.pop("radius", None)
        pagetoken = p.pop("pagetoken", None)
        language = p.pop("language", "ja")
        type_ = p.pop("type", None)
        opennow = p.pop("opennow", p.pop("open_now", None))
        keyword = p.pop("keyword", None)
        kwargs.update(p)
        data, _ = _client().nearby_search(
            location=location,
            radius=radius,
            keyword=keyword,
            language=language,
            pagetoken=pagetoken,
            type_=type_,
            opennow=opennow,
            **kwargs,
        )
        return data
    else:
        data, _ = _client().nearby_search(**kwargs)
        return data


def place_details(place_id: str, **kwargs) -> Dict[str, Any]:
    return _client().place_details(place_id, **kwargs)


def photo(photo_reference: str, **kwargs) -> Tuple[bytes, str]:
    # 単なるラッパ。マスク済みログはクライアント側で行う
    return _client().photo(photo_reference, **kwargs)


__all__ = [
    "GooglePlacesClient",
    # ラッパ
    "text_search",
    "nearby_search",
    "place_details",
    "photo",
    # 低レベル API（tests が参照）
    "textsearch",
    "details",
    "findplacefromtext",
    "find_place_from_text",
    "find_place",
    # テスト用フック
    "req_history",
]
