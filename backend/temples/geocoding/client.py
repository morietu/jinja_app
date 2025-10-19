from __future__ import annotations

import os
import typing as t
from dataclasses import dataclass

import requests


@dataclass
class GeocodeResult:
    lat: float
    lon: float
    formatted: str
    precision: str  # "rooftop" / "street" / "city" / "region" / "approx"
    provider: str
    raw: dict


class GeocodingError(Exception):
    pass


class GeocodingClient:
    def __init__(self, session: t.Optional[requests.Session] = None):
        self.session = session or requests.Session()
        self.provider = (os.getenv("GEOCODER_PROVIDER") or "opencage").lower()

        # 共通キー > プロバイダ別キー（google用の別名も拾う）
        self.api_key = (
            os.getenv("GEOCODER_API_KEY")
            or (
                self.provider == "google"
                and (os.getenv("GOOGLE_MAPS_API_KEY") or os.getenv("GOOGLE_PLACES_API_KEY"))
            )
            or ""
        )
        if not self.api_key:
            need = (
                "GEOCODER_API_KEY もしくは（googleの場合）GOOGLE_MAPS_API_KEY/GOOGLE_PLACES_API_KEY"
            )
            raise GeocodingError(f"{need} が設定されていません。")

        self.timeout = float(os.getenv("GEOCODER_TIMEOUT", "10"))

    # --- 単発（もっとも確からしい1件） -------------------------------------
    def geocode(self, address: str) -> GeocodeResult:
        address = (address or "").strip()
        if not address:
            raise ValueError("address は必須です。")
        if self.provider == "opencage":
            return self._geocode_opencage(address)
        if self.provider == "google":
            return self._geocode_google(address)
        raise GeocodingError(f"未対応のプロバイダ: {self.provider}")

    # --- 複数候補（あいまい検索） -------------------------------------------
    def geocode_candidates(self, address: str, limit: int = 5) -> list[GeocodeResult]:
        address = (address or "").strip()
        if not address:
            raise ValueError("address は必須です。")
        limit = max(1, min(int(limit or 1), 10))
        if self.provider == "opencage":
            return self._geocode_opencage_multi(address, limit=limit)
        if self.provider == "google":
            return self._geocode_google_multi(address, limit=limit)
        raise GeocodingError(f"未対応のプロバイダ: {self.provider}")

    # ===================== Google =====================
    def _geocode_google(self, address: str) -> GeocodeResult:
        url = "https://maps.googleapis.com/maps/api/geocode/json"
        params = {"address": address, "key": self.api_key, "language": "ja", "region": "jp"}
        r = self.session.get(url, params=params, timeout=self.timeout)
        try:
            r.raise_for_status()
        except requests.HTTPError as e:
            raise GeocodingError(f"Google Geocoding HTTP {r.status_code}: {r.text[:200]}") from e

        data = r.json()
        self._assert_google_ok(data)

        top = data["results"][0]
        loc = top["geometry"]["location"]
        loc_type = (top["geometry"].get("location_type") or "APPROXIMATE").upper()

        return GeocodeResult(
            lat=float(loc["lat"]),
            lon=float(loc["lng"]),
            formatted=top.get("formatted_address") or address,
            precision=self._google_loc_type_to_precision(loc_type),
            provider="google",
            raw=top,
        )

    def _geocode_google_multi(self, address: str, limit: int = 5) -> list[GeocodeResult]:
        url = "https://maps.googleapis.com/maps/api/geocode/json"
        params = {"address": address, "key": self.api_key, "language": "ja", "region": "jp"}
        r = self.session.get(url, params=params, timeout=self.timeout)
        try:
            r.raise_for_status()
        except requests.HTTPError as e:
            raise GeocodingError(f"Google Geocoding HTTP {r.status_code}: {r.text[:200]}") from e

        data = r.json()
        self._assert_google_ok(data)

        out: list[GeocodeResult] = []
        for top in data.get("results", [])[:limit]:
            loc = top["geometry"]["location"]
            loc_type = (top["geometry"].get("location_type") or "APPROXIMATE").upper()
            out.append(
                GeocodeResult(
                    lat=float(loc["lat"]),
                    lon=float(loc["lng"]),
                    formatted=top.get("formatted_address") or address,
                    precision=self._google_loc_type_to_precision(loc_type),
                    provider="google",
                    raw=top,
                )
            )
        return out

    @staticmethod
    def _google_loc_type_to_precision(loc_type: str) -> str:
        # ROOFTOP, RANGE_INTERPOLATED, GEOMETRIC_CENTER, APPROXIMATE
        if loc_type == "ROOFTOP":
            return "rooftop"
        if loc_type == "RANGE_INTERPOLATED":
            return "street"
        if loc_type == "GEOMETRIC_CENTER":
            return "city"
        return "approx"

    @staticmethod
    def _assert_google_ok(data: dict) -> None:
        status = data.get("status")
        if status == "OK" and data.get("results"):
            return
        if status in {
            "ZERO_RESULTS",
            "OVER_QUERY_LIMIT",
            "REQUEST_DENIED",
            "INVALID_REQUEST",
            "UNKNOWN_ERROR",
        }:
            msg = data.get("error_message") or status
            raise GeocodingError(f"Google Geocoding: {status}: {msg}")
        raise GeocodingError(f"Google Geocoding: {status} {str(data)[:200]}")

    # ===================== OpenCage =====================
    def _geocode_opencage(self, address: str) -> GeocodeResult:
        url = "https://api.opencagedata.com/geocode/v1/json"
        params = {
            "q": address,
            "key": self.api_key,
            "language": "ja",
            "limit": 1,
            "no_annotations": 1,
            "countrycode": "jp",
        }
        resp = self.session.get(url, params=params, timeout=self.timeout)
        if resp.status_code != 200:
            text = getattr(resp, "text", "")[:200]
            raise GeocodingError(f"OpenCage HTTP {resp.status_code}: {text}")

        data = resp.json()
        results = data.get("results", []) or []
        if not results:
            raise GeocodingError("該当するジオコーディング結果が見つかりませんでした。")

        top = results[0]
        geom = top.get("geometry") or {}
        lat, lng = geom.get("lat"), geom.get("lng")
        if lat is None or lng is None:
            raise GeocodingError("座標を抽出できませんでした。")

        components = top.get("components") or {}
        confidence = top.get("confidence")  # 1-10 or None
        precision = self._infer_precision_from_opencage(components, confidence)
        formatted = top.get("formatted") or address

        return GeocodeResult(
            lat=float(lat),
            lon=float(lng),
            formatted=formatted,
            precision=precision,
            provider="opencage",
            raw=top,
        )

    def _geocode_opencage_multi(self, address: str, limit: int = 5) -> list[GeocodeResult]:
        url = "https://api.opencagedata.com/geocode/v1/json"
        params = {
            "q": address,
            "key": self.api_key,
            "language": "ja",
            "limit": max(1, min(int(limit or 1), 10)),
            "no_annotations": 1,
            "countrycode": "jp",
        }
        resp = self.session.get(url, params=params, timeout=self.timeout)
        if resp.status_code != 200:
            text = getattr(resp, "text", "")[:200]
            raise GeocodingError(f"OpenCage HTTP {resp.status_code}: {text}")

        data = resp.json()
        out: list[GeocodeResult] = []
        for top in data.get("results") or []:
            geom = top.get("geometry") or {}
            lat, lng = geom.get("lat"), geom.get("lng")
            if lat is None or lng is None:
                continue
            components = top.get("components") or {}
            conf = top.get("confidence")  # 1-10 or None
            precision = self._infer_precision_from_opencage(components, conf)
            formatted = top.get("formatted") or address
            out.append(
                GeocodeResult(
                    lat=float(lat),
                    lon=float(lng),
                    formatted=formatted,
                    precision=precision,
                    provider="opencage",
                    raw=top,
                )
            )
        return out

    @staticmethod
    def _infer_precision_from_opencage(components: dict, confidence: t.Optional[int]) -> str:
        if "house_number" in components or "building" in components:
            return "rooftop"
        if "road" in components:
            return "street"
        if any(k in components for k in ("city", "town", "village")):
            return "city"
        if any(k in components for k in ("state", "region")):
            return "region"
        if confidence is not None and confidence >= 8:
            return "street"
        return "approx"
