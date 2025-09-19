import os
import logging
from typing import Dict, Any, Optional, Tuple
import requests
from django.conf import settings

logger = logging.getLogger(__name__)

API_KEY = (
    os.getenv("GOOGLE_PLACES_API_KEY")
    or os.getenv("GOOGLE_MAPS_API_KEY")
    or getattr(settings, "GOOGLE_PLACES_API_KEY", None)
    or getattr(settings, "GOOGLE_MAPS_API_KEY", None)
)


class GooglePlacesClient:
    BASE_URL = "https://maps.googleapis.com/maps/api/place"

    def __init__(self, api_key: Optional[str] = None, timeout: Optional[float] = None):
        self.api_key = api_key or API_KEY
        if not self.api_key:
            raise RuntimeError(
                "Google Places API key is not set. "
                "Set GOOGLE_PLACES_API_KEY (or GOOGLE_MAPS_API_KEY)."
            )
        self.timeout = timeout if timeout is not None else float(
            os.getenv("GOOGLE_PLACES_TIMEOUT", "8.0")
        )

    def _get(self, path: str, params: Dict[str, Any]) -> requests.Response:
        url = f"{self.BASE_URL}/{path}/json"
        q = {"key": self.api_key, **params}
        resp = requests.get(url, params=q, timeout=self.timeout)
        # APIキーがログに出ないようマスク
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
            logger.error("Places text_search error: %s, msg=%s", status, data.get("error_message"))
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
            logger.error("Places nearby_search error: %s, msg=%s", status, data.get("error_message"))
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
            logger.error("Places details error: %s, msg=%s", data.get("status"), data.get("error_message"))
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
        """(bytes, content_type) を返す"""
        url = f"{self.BASE_URL}/photo"
        params = self.build_photo_params(photo_reference, maxwidth=maxwidth, maxheight=maxheight)
        resp = requests.get(url, params=params, timeout=self.timeout, stream=True)
        logger.info("Places upstream[photo]: %s", resp.url)
        resp.raise_for_status()
        content_type = resp.headers.get("Content-Type", "image/jpeg")
        return resp.content, content_type

    # 追加：Find Place（指名打ち）— デフォルト fields をクライアント側で補う
    def find_place_from_text(
        self,
        input_text: str,
        *,
        language: str = "ja",
        locationbias: Optional[str] = None,
        fields: Optional[str] = None,
    ) -> Dict[str, Any]:
        params: Dict[str, Any] = {
            "input": input_text,
            "inputtype": "textquery",
            "language": language,
        }
        if locationbias:
            params["locationbias"] = locationbias

        # ★ fields を明示しない呼び出しでも十分な情報が返るようデフォルトを補完
        params["fields"] = fields or (
            "place_id,name,geometry,formatted_address,types,photos,opening_hours,"
            "rating,user_ratings_total,icon"
        )

        data = self._get("findplacefromtext", params).json()
        status = data.get("status")
        if status not in ("OK", "ZERO_RESULTS"):
            logger.error("Places findplace error: %s, msg=%s", status, data.get("error_message"))
            self._ensure_ok(data)

        # 既存の正規化に合わせて整形
        results = []
        for c in data.get("candidates", []):
            r = {
                "place_id": c.get("place_id"),
                "name": c.get("name"),
                "formatted_address": c.get("formatted_address"),
                "geometry": c.get("geometry"),
                "types": c.get("types"),
                "photos": c.get("photos", []),
                "opening_hours": c.get("opening_hours"),
                "icon": c.get("icon"),
                "rating": c.get("rating"),
                "user_ratings_total": c.get("user_ratings_total"),
            }
            results.append(self._normalize_result(r))
        return {"results": results, "status": status}


# ======== ここから下が “テストが patch する” モジュール関数（1セットだけ！） ========
_client_singleton: Optional[GooglePlacesClient] = None


def _client() -> GooglePlacesClient:
    global _client_singleton
    if _client_singleton is None:
        _client_singleton = GooglePlacesClient()
    return _client_singleton


def text_search(query_or_params=None, **kwargs) -> Dict[str, Any]:
    """
    後方互換ラッパ:
    - 旧: text_search({"q": "...", "language":"ja", "region":"jp", ...})
    - 新: text_search("キーワード", language="ja", region="jp", ...)
    """
    if isinstance(query_or_params, dict):
        p = dict(query_or_params)  # 破壊防止でコピー
        query = p.pop("q", None) or p.pop("query", "") or ""
        # 旧→新のキー変換
        location = p.pop("location", None)
        # lat,lng を渡していた旧呼び出しに対応
        if not location and p.get("lat") is not None and p.get("lng") is not None:
            location = f"{p.pop('lat')},{p.pop('lng')}"
        pagetoken = p.pop("pagetoken", None)
        language = p.pop("language", "ja")
        region = p.pop("region", "jp")
        open_now = p.pop("opennow", p.pop("open_now", None))
        minprice = p.pop("minprice", None)
        maxprice = p.pop("maxprice", None)
        type_ = p.pop("type", None)
        # 余剰は kwargs に流す
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
        # 新APIスタイル
        query = query_or_params if query_or_params is not None else kwargs.pop("query", "")
        data, _ = _client().text_search(query, **kwargs)
        return data


def nearby_search(params_or_none=None, **kwargs) -> Dict[str, Any]:
    """
    後方互換ラッパ:
    - 旧: nearby_search({"lat":..,"lng":..,"radius":..,"keyword":...})
    - 新: nearby_search(location="lat,lng", radius=..., keyword=...)
    """
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


def details(place_id: str, *args, **kwargs):
    """
    Backward-compat layer:
    - details(place_id, "a,b,c")         # 旧: 位置引数で fields 文字列
    - details(place_id, ["a","b","c"])   # 旧: 配列で fields
    - details(place_id, {"fields":"a,b","language":"ja"})  # 旧: dict まとめ渡し
    - details(place_id, fields="a,b", language="ja")       # 新
    """
    if args:
        first = args[0]
        if isinstance(first, dict):
            # 旧スタイル: 第2引数がパラメータ dict
            kwargs.update(first)
        else:
            # 旧スタイル: 第2引数が fields（文字列 or 配列）
            if "fields" not in kwargs:
                if isinstance(first, (list, tuple)):
                    kwargs["fields"] = ",".join(first)
                else:
                    kwargs["fields"] = str(first)
    return _client().place_details(place_id, **kwargs)

def find_place_text(input_text: str, **kwargs) -> Dict[str, Any]:
    return _client().find_place_from_text(input_text, **kwargs)


__all__ = [
    "GooglePlacesClient",
    "text_search",
    "nearby_search",
    "place_details",
    "photo",
    "details",
    "find_place_text",
]
