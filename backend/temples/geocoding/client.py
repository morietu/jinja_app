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

    # --- 単発（もっとも確からしい1件） -------------------------------------
    def geocode(self, address: str) -> GeocodeResult:
        address = (address or "").strip()
        if not address:
            raise ValueError("address は必須です。")
        if self.provider == "opencage":
            return self._geocode_opencage(address)
        raise GeocodingError(f"未対応のプロバイダ: {self.provider}")

    # --- 複数候補（あいまい検索） -------------------------------------------
    def geocode_candidates(self, address: str, limit: int = 5) -> list[GeocodeResult]:
        address = (address or "").strip()
        if not address:
            raise ValueError("address は必須です。")
        if self.provider == "opencage":
            return self._geocode_opencage_multi(address, limit=limit)
        raise GeocodingError(f"未対応のプロバイダ: {self.provider}")

    # --- OpenCage 実装：単発 ---------------------------------------------------
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
        resp = self.session.get(url, params=params, timeout=10)
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

    # --- OpenCage 実装：複数候補 ----------------------------------------------
    def _geocode_opencage_multi(self, address: str, limit: int = 5) -> list[GeocodeResult]:
        url = "https://api.opencagedata.com/geocode/v1/json"
        params = {
            "q": address,
            "key": self.api_key,
            "language": "ja",
            "limit": max(1, min(int(limit or 1), 10)),  # 1..10
            "no_annotations": 1,
            "countrycode": "jp",
        }
        resp = self.session.get(url, params=params, timeout=10)
        if resp.status_code != 200:
            text = getattr(resp, "text", "")[:200]
            raise GeocodingError(f"OpenCage HTTP {resp.status_code}: {text}")

        data = resp.json()
        out: list[GeocodeResult] = []
        for top in (data.get("results") or []):
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

    # --- 共通：精度の推定 ------------------------------------------------------
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
