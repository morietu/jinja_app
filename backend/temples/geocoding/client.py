from __future__ import annotations
import os
import typing as t
import requests
from dataclasses import dataclass

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
        self.provider = os.getenv("GEOCODER_PROVIDER", "opencage").lower()
        self.api_key = os.getenv("GEOCODER_API_KEY", "")
        if not self.api_key:
            raise GeocodingError("GEOCODER_API_KEY が設定されていません。")

    def geocode(self, address: str) -> GeocodeResult:
        address = (address or "").strip()
        if not address:
            raise ValueError("address は必須です。")
        if self.provider == "opencage":
            return self._geocode_opencage(address)
        raise GeocodingError(f"未対応のプロバイダ: {self.provider}")

    def _geocode_opencage(self, address: str) -> GeocodeResult:
        url = "https://api.opencagedata.com/geocode/v1/json"
        params = {"q": address, "key": self.api_key, "language": "ja", "limit": 1, "no_annotations": 1, "countrycode": "jp"}
        resp = self.session.get(url, params=params, timeout=10)
        if resp.status_code != 200:
            text = getattr(resp, "text", "")[:200]
            raise GeocodingError(f"OpenCage HTTP {resp.status_code}: {text}")

        data = resp.json()
        results = data.get("results", [])
        if not results:
            raise GeocodingError("該当するジオコーディング結果が見つかりませんでした。")

        top = results[0]
        geom = top.get("geometry", {})
        lat, lng = geom.get("lat"), geom.get("lng")
        if lat is None or lng is None:
            raise GeocodingError("座標を抽出できませんでした。")

        components = top.get("components", {})
        confidence = top.get("confidence", None)  # 1-10
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
