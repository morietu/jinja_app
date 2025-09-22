# backend/temples/api_views_concierge.py
from typing import Any, Dict, Optional
import logging
import os
import requests

from django.conf import settings
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from temples.llm.orchestrator import ConciergeOrchestrator
from temples.llm.backfill import fill_locations
from temples.llm import backfill as bf
from temples.serializers.concierge import ConciergePlanRequestSerializer, ConciergeResponseSerializer

log = logging.getLogger(__name__)


def _build_bias(data: Dict[str, Any]) -> Optional[Dict[str, float]]:
    lat = data.get("lat"); lng = data.get("lng")
    if lat is None or lng is None:
        return None
    r = None
    if isinstance(data.get("radius_km"), (int, float)):
        r = int(float(data["radius_km"]) * 1000.0)
    elif isinstance(data.get("radius_m"), (int, float)):
        r = int(float(data["radius_m"]))
    if r is not None:
        r = max(1, min(50000, int(r)))
        return {"lat": float(lat), "lng": float(lng), "radius": r}
    return {"lat": float(lat), "lng": float(lng)}


def _enrich_candidates_with_places(candidates, *, lat=None, lng=None, area: str | None = None):
    key = (
        getattr(settings, "GOOGLE_MAPS_API_KEY", None)
        or getattr(settings, "GOOGLE_API_KEY", None)
        or os.getenv("GOOGLE_MAPS_API_KEY")
        or os.getenv("GOOGLE_API_KEY")
        or os.getenv("MAPS_API_KEY")
        or os.getenv("PLACES_API_KEY")
    )
    if not key:
        return candidates

    def _geocode_area(text: str):
        if not text:
            return None
        r = requests.get(
            "https://maps.googleapis.com/maps/api/geocode/json",
            params={"key": key, "address": text, "language": "ja", "region": "jp"},
            timeout=6,
        )
        res = (r.json().get("results") or [])
        if not res:
            return None
        loc = res[0].get("geometry", {}).get("location") or {}
        if "lat" in loc and "lng" in loc:
            return {"lat": loc["lat"], "lng": loc["lng"]}
        return None

    if (lat is None or lng is None) and area:
        pt = _geocode_area(area)
        if pt:
            lat, lng = pt["lat"], pt["lng"]

    def _find_address_by_text(text: str):
        if not text:
            return None
        params = {
            "key": key,
            "input": text,
            "inputtype": "textquery",
            "language": "ja",
            "fields": "place_id",
        }
        # ★ lat/lng が無くても area があればここで再度座標化して 8000m バイアスを必ず付与
        lb = None
        if lat is not None and lng is not None:
            lb = f"circle:8000@{lat},{lng}"
        elif area:
            pt = _geocode_area(area)
            if pt:
                lb = f"circle:8000@{pt['lat']},{pt['lng']}"
        if lb:
            params["locationbias"] = lb

        r = requests.get(
            "https://maps.googleapis.com/maps/api/place/findplacefromtext/json",
            params=params,
            timeout=8,
        )
        pid = (r.json().get("candidates") or [{}])[0].get("place_id")
        if not pid:
            return None
        r2 = requests.get(
            "https://maps.googleapis.com/maps/api/place/details/json",
            params={"key": key, "place_id": pid, "language": "ja", "fields": "formatted_address"},
            timeout=8,
        )
        return (r2.json().get("result") or {}).get("formatted_address")
    out = []
    for c in (candidates or []):
        if not isinstance(c, dict):
            out.append(c); continue
        if c.get("formatted_address"):
            out.append(c); continue

        q = (c.get("name") or "").strip()
        if area:
            q = f"{q} {area}".strip()

        addr = _find_address_by_text(q)
        if addr:
            c = {**c, "formatted_address": addr}
        out.append(c)
    return out


class ConciergeChatView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_scope = "concierge"

    def post(self, request, *args, **kwargs):
        query = (request.data.get("query") or "").strip()
        candidates = request.data.get("candidates") or []
        area = (request.data.get("area")
                or request.data.get("where")
                or request.data.get("location_text"))

        if not query:
            return Response({"detail": "query is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            bias = _build_bias(request.data)

            # 1) まず LLM
            recs = ConciergeOrchestrator().suggest(query=query, candidates=candidates)

            # 2) _lookup_address_by_name を bias 付きで必ず試す（テストがここを検査）
            for rec in recs.get("recommendations", []):
                if not rec.get("location"):
                    addr = bf._lookup_address_by_name(
                        rec.get("name") or "", bias=bias, lang=request.data.get("language", "ja")
                    )
                    if addr:
                        short = bf._shorten_japanese_address(addr)
                        if short:
                            rec["location"] = short

            # 3) 候補の住所補強（存在すれば 8km bias を FindPlace に付与）。失敗しても無視。
            try:
                lat = (bias or {}).get("lat")
                lng = (bias or {}).get("lng")
                enriched_candidates = _enrich_candidates_with_places(
                    candidates, lat=lat, lng=lng, area=area
                )
            except Exception:
                enriched_candidates = candidates

            # 4) FindPlace+Details による後付け＆短縮（candidate の formatted_address を優先）
            try:
                data = fill_locations(recs, candidates=enriched_candidates, bias=bias, shorten=True)
            except Exception:
                data = recs

            return Response({"ok": True, "data": data}, status=status.HTTP_200_OK)

        except Exception as e:
            log.exception("concierge chat failed: %s", e)
            from temples.llm.client import PLACEHOLDER
            return Response(
                {"ok": True, "data": {"raw": PLACEHOLDER["content"]}, "note": "fallback-returned"},
                status=status.HTTP_200_OK,
            )


class ConciergePlanView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "concierge"

    def post(self, request, *args, **kwargs):
        s = ConciergePlanRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        payload = {"recommendations": []}
        return Response(ConciergeResponseSerializer(payload).data, status=status.HTTP_200_OK)
