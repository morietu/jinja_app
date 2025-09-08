# temples/services/google_places.py
import os
import logging
from typing import Dict, Any, Optional, Tuple
import requests

logger = logging.getLogger(__name__)

class GooglePlacesClient:
    BASE_URL = "https://maps.googleapis.com/maps/api/place"

    def __init__(self, api_key: Optional[str] = None, timeout: float | None = None):
        self.api_key = api_key or os.getenv("GOOGLE_PLACES_API_KEY")
        if not self.api_key:
            raise RuntimeError("GOOGLE_PLACES_API_KEY is not set")
        self.timeout = timeout if timeout is not None else float(
            os.getenv("GOOGLE_PLACES_TIMEOUT", "8.0")
        )

    def _get(self, path: str, params: Dict[str, Any]) -> requests.Response:
        url = f"{self.BASE_URL}/{path}/json"
        q = {"key": self.api_key, **params}
        resp = requests.get(url, params=q, timeout=self.timeout)
        logger.info("Places upstream[%s]: %s", path, resp.url)
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
        loc = (geometry.get("location") or {})
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

    def place_details(self, place_id: str, *, language: str = "ja", fields: Optional[str] = None) -> Dict[str, Any]:
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


# ======== ここから下が “テストが patch する” モジュール関数（1セットだけ！） ========
_client_singleton: Optional[GooglePlacesClient] = None

def _client() -> GooglePlacesClient:
    global _client_singleton
    if _client_singleton is None:
        _client_singleton = GooglePlacesClient()
    return _client_singleton

def text_search(query: str, **kwargs) -> Dict[str, Any]:
    data, _ = _client().text_search(query, **kwargs)
    return data

def nearby_search(**kwargs) -> Dict[str, Any]:
    data, _ = _client().nearby_search(**kwargs)
    return data

def place_details(place_id: str, **kwargs) -> Dict[str, Any]:
    return _client().place_details(place_id, **kwargs)

def photo(photo_reference: str, **kwargs) -> Tuple[bytes, str]:
    return _client().photo(photo_reference, **kwargs)

def details(place_id: str, **kwargs):
    # 既存の place_details をそのまま呼ぶ
    return _client().place_details(place_id, **kwargs)

__all__ = ["GooglePlacesClient", "text_search", "nearby_search", "place_details", "photo", "details"]
