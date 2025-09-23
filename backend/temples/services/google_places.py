# temples/services/google_places.py
import logging
import os
import sys
from typing import Any, Dict, List, Optional, Tuple

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

# ===== Request history recorder (for tests) =====
# tests 側の fixture はこの list を毎テストごとにクリアして使う
req_history: List[Tuple[str, Dict[str, Any]]] = []


def _record(url: str, params: Dict[str, Any]) -> None:
    # tests でアサートしやすいよう shallow copy を残す
    try:
        req_history.append((url, dict(params or {})))
    except Exception:
        # 記録はテスト補助なので本処理を邪魔しない
        pass


# ------------------------------------------------------------
# req_history: places 側を唯一の真実にする（読み取りは動的に）
# ------------------------------------------------------------
def _get_places_history() -> list:
    """常に temples.services.places.req_history（list）を返す。無ければ作る。"""
    try:
        from . import places as _PLACES

        if not hasattr(_PLACES, "req_history") or not isinstance(_PLACES.req_history, list):
            _PLACES.req_history = []
        return _PLACES.req_history
    except Exception:
        # 超初期のみフォールバック
        return globals().setdefault("_fallback_req_history", [])


def __getattr__(name: str):
    # google_places.req_history を参照されたら常に places 側の箱を返す
    if name == "req_history":
        return _get_places_history()
    raise AttributeError(name)


# ↑の関数“外”で必ず束縛しておく（tests 側の import タイミング対策）
req_history = _get_places_history()
try:
    import temples.services as _PKG

    _PKG.req_history = req_history
except Exception:
    pass

# ------------------------------------------------------------
# API キー
# ------------------------------------------------------------
API_KEY = (
    os.getenv("GOOGLE_PLACES_API_KEY")
    or os.getenv("GOOGLE_MAPS_API_KEY")
    or getattr(settings, "GOOGLE_PLACES_API_KEY", None)
    or getattr(settings, "GOOGLE_MAPS_API_KEY", None)
)

try:
    from temples.services.places import (
        text_search_first as text_search_first,
    )  # noqa: F401
except Exception:
    text_search_first = None


# ------------------------------------------------------------
# 履歴の正規箱を決定（tests がどこを monkeypatch しても拾えるように）
# ------------------------------------------------------------
def _canonical_history() -> list:
    svc = None
    pm = None
    try:
        import temples.services as svc  # type: ignore
    except Exception:
        pass
    try:
        from . import places as pm  # type: ignore
    except Exception:
        pass

    candidates = []

    # 1) このモジュールのグローバル（tests が google_places.req_history を差し替える場合が最優先）
    gp_hist = globals().get("req_history", None)
    if isinstance(gp_hist, list):
        candidates.append(gp_hist)

    # 2) temples.services.req_history
    if svc is not None and isinstance(getattr(svc, "req_history", None), list):
        candidates.append(svc.req_history)

    # 3) temples.services.places.req_history
    if pm is not None and isinstance(getattr(pm, "req_history", None), list):
        candidates.append(pm.req_history)

    # どこにも無ければ新しく用意
    canonical = candidates[0] if candidates else []

    # 参照をすべて正規箱へ寄せる（“作る”のはここだけ）
    globals()["req_history"] = canonical
    try:
        if svc is not None:
            svc.req_history = canonical
    except Exception:
        pass
    try:
        if pm is not None:
            pm.req_history = canonical
    except Exception:
        pass

    return canonical


# ------------------------------------------------------------
# 履歴 push：正規箱にだけ 1 回 append（キーは伏字）
# ------------------------------------------------------------
def _push_req_history(url: str, params: dict) -> None:
    masked = dict(params or {})
    if "key" in masked:
        masked["key"] = "****"

    candidates: list[list] = []

    # 1) このモジュール直下（tests が google_places.req_history を差し替えるケース）
    gp_hist = globals().get("req_history", None)
    if isinstance(gp_hist, list):
        candidates.append(gp_hist)

    # 2) places モジュール直下
    pm = None
    pm_hist = None
    try:
        from . import places as pm  # type: ignore

        pm_hist = getattr(pm, "req_history", None)
        if not isinstance(pm_hist, list):
            pm_hist = []
            pm.req_history = pm_hist
        candidates.append(pm_hist)
    except Exception:
        pm = None

    # 3) temples.services 直下
    pkg = None
    pkg_hist = None
    try:
        import temples.services as pkg  # type: ignore

        pkg_hist = getattr(pkg, "req_history", None)
        if not isinstance(pkg_hist, list):
            pkg_hist = []
            pkg.req_history = pkg_hist
        candidates.append(pkg_hist)
    except Exception:
        pkg = None

    # どれも無い極初期はフォールバック
    if not candidates:
        fallback = globals().setdefault("_fallback_req_history", [])
        candidates.append(fallback)

    # 重複（同一オブジェクト）を除外
    uniq: list[list] = []
    seen: set[int] = set()
    for lst in candidates:
        if not isinstance(lst, list):
            continue
        lid = id(lst)
        if lid in seen:
            continue
        uniq.append(lst)
        seen.add(lid)

    # すべての箱に 1 回ずつ追加（fixture が握る箱にも必ず入る）
    for lst in uniq:
        lst.append((url, masked))

    # 以後の参照は先頭に決めた“正規箱”へ寄せる（基本は places）
    canonical = pm_hist or gp_hist or pkg_hist or uniq[0]
    globals()["req_history"] = canonical
    try:
        if pm is not None:
            pm.req_history = canonical
    except Exception:
        pass
    try:
        if pkg is not None:
            pkg.req_history = canonical
    except Exception:
        pass


# ------------------------------------------------------------
# 高レベルクライアント
# ------------------------------------------------------------
class GooglePlacesClient:
    BASE_URL = "https://maps.googleapis.com/maps/api/place"

    def __init__(self, api_key: Optional[str] = None, timeout: Optional[float] = None):
        self.api_key = api_key or API_KEY
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

        # tests が参照する履歴に積む（API キーは伏字）
        _push_req_history(url, q)

        # 実呼び出し
        resp = requests.get(url, params=q, timeout=self.timeout)

        # ログ（キーは伏字）
        try:
            safe_url = resp.url.replace(self.api_key, "****")
        except Exception:
            safe_url = "<masked>"
        logger.info("Places upstream[%s] %s", path, safe_url)

        resp.raise_for_status()
        return resp

    @staticmethod
    def _ensure_ok(data: Dict[str, Any]) -> None:
        status = data.get("status")
        if status in ("OK", "ZERO_RESULTS"):
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
        status = data.get("status")
        if status not in ("OK", "ZERO_RESULTS"):
            logger.error(
                "Places text_search error: %s, msg=%s",
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
        params: Dict[str, Any] = {"place_id": place_id, "language": language}
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
        logger.info("Places upstream[photo]: %s", resp.url)
        resp.raise_for_status()
        content_type = resp.headers.get("Content-Type", "image/jpeg")
        return resp.content, content_type


# ------------------------------------------------------------
# 低レベル API（tests が直接参照）
# ------------------------------------------------------------
_TIMEOUT = 10


def _log_upstream(kind: str, url: str, params: dict):
    masked = dict(params or {})
    if "key" in masked:
        masked["key"] = "****"
    qs = "&".join(f"{k}={v}" for k, v in masked.items() if v is not None)
    print(f"Places upstream[{kind}] {url}?{qs}", file=sys.stderr)


def textsearch(
    *,
    query: str,
    language: str | None = None,
    region: str | None = None,
    location: str | None = None,
    radius: int | None = None,
    type: str | None = None,
    pagetoken: str | None = None,
):
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


def details(*, place_id: str, language: str | None = None, fields: str | None = None):
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
    language: str | None = None,
    locationbias: str | None = None,
    fields: str | None = None,
):
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
