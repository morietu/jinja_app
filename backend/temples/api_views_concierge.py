# backend/temples/api_views_concierge.py
import logging
import os
from typing import Any, Dict, Optional

import requests
from django.conf import settings
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from temples.domain.fortune import fortune_profile
from temples.domain.match import bonus_score
from temples.llm import backfill as bf
from temples.llm.backfill import fill_locations
from temples.llm.orchestrator import ConciergeOrchestrator
from temples.serializers.concierge import ConciergePlanRequestSerializer
from temples.services import google_places as GP

log = logging.getLogger(__name__)


def _parse_radius(data: Dict[str, Any]) -> int:
    """radius_m / radius_km を m に変換（既定 8000、1..50000 にクリップ）"""
    if (rm := data.get("radius_m")) is not None:
        try:
            r = int(float(rm))
        except Exception:
            r = None
    elif (rk := data.get("radius_km")) is not None:
        if isinstance(rk, str):
            rk = rk.strip().lower().replace("km", "")
        try:
            r = int(float(rk) * 1000)
        except Exception:
            r = None
    else:
        r = 8000
    if r is None:
        r = 8000
    return max(1, min(50000, r))


def _build_bias(data: Dict[str, Any]) -> Optional[Dict[str, float]]:
    """
    - area/where/location_text があれば geocode で中心座標
    - なければ payload の lat/lng
    - 半径は _parse_radius()
    """
    lat = data.get("lat")
    lng = data.get("lng")
    area_text = (data.get("where") or data.get("area") or data.get("location_text") or "").strip()
    if area_text:
        try:
            center = bf._geocode_text_center(area_text)
            if center:
                lat = center.get("lat", lat)
                lng = center.get("lng", lng)
        except Exception:
            pass
    if lat is None or lng is None:
        return None
    try:
        lat = float(lat)
        lng = float(lng)
    except Exception:
        return None
    return {"lat": lat, "lng": lng, "radius": _parse_radius(data)}


def _enrich_candidates_with_places(candidates, *, lat=None, lng=None, area: str | None = None):
    """
    candidate に formatted_address が無ければ Places で補う（8km bias）
    API キーが無い場合はそのまま返す
    """
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
        res = r.json().get("results") or []
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
            params={
                "key": key,
                "place_id": pid,
                "language": "ja",
                "fields": "formatted_address",
            },
            timeout=8,
        )
        return (r2.json().get("result") or {}).get("formatted_address")

    out = []
    for c in candidates or []:
        if not isinstance(c, dict):
            out.append(c)
            continue
        if c.get("formatted_address"):
            out.append(c)
            continue
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

    # NOTE: 分割は別PRで。いったんCI通過のため複雑度を許容。 # noqa: C901
    def post(self, request, *args, **kwargs):  # noqa: C901
        query = (request.data.get("query") or "").strip()
        candidates = request.data.get("candidates") or []
        area = (
            request.data.get("area")
            or request.data.get("where")
            or request.data.get("location_text")
        )
        language = request.data.get("language", "ja")

        if not query:
            return Response({"detail": "query is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            bias = _build_bias(request.data)

            # 1) LLM 推薦
            try:
                recs = ConciergeOrchestrator().suggest(query=query, candidates=candidates)
            except RuntimeError:
                try:
                    recs = ConciergeOrchestrator.suggest(None, query=query, candidates=candidates)
                except Exception:
                    recs = {"recommendations": []}
            except Exception:
                recs = {"recommendations": []}

            # 2) bias 付きで住所補完
            for rec in recs.get("recommendations", []):
                if not rec.get("location"):
                    try:
                        addr = bf._lookup_address_by_name(
                            rec.get("name") or "", bias=bias, lang=language
                        )
                    except Exception:
                        addr = None
                    if addr:
                        short = bf._shorten_japanese_address(addr)
                        if short:
                            rec["location"] = short

            # 3) 候補の住所補強（8km bias で Places）
            try:
                lat = (bias or {}).get("lat")
                lng = (bias or {}).get("lng")
                enriched_candidates = _enrich_candidates_with_places(
                    candidates, lat=lat, lng=lng, area=area
                )
            except Exception:
                enriched_candidates = candidates

            # 4) FindPlace+Details で後付け（shorten=True）
            try:
                data = fill_locations(recs, candidates=enriched_candidates, bias=bias, shorten=True)
            except Exception:
                data = recs

            # 5) LLMが空 → DBから近傍×重み
            if not (data.get("recommendations") or []):
                import math
                from datetime import timedelta

                from django.db import models
                from django.db.models.functions import Abs, Coalesce
                from django.utils import timezone
                from temples.models import Shrine

                limit = int(request.data.get("limit", 5))
                since = timezone.now() - timedelta(days=30)
                qs = Shrine.objects.all().annotate(
                    visits_30d=models.Count(
                        "visits", filter=models.Q(visits__visited_at__gte=since)
                    ),
                    favs_30d=models.Count(
                        "favorited_by", filter=models.Q(favorited_by__created_at__gte=since)
                    ),
                    _popular=Coalesce(models.F("popular_score"), models.Value(0.0)),
                )
                lat0 = (bias or {}).get("lat")
                lng0 = (bias or {}).get("lng")
                r_m = (bias or {}).get("radius")
                if lat0 is not None and lng0 is not None and r_m:
                    try:
                        dlat = (float(r_m) / 1000.0) / 111.0
                        dlng = (float(r_m) / 1000.0) / (
                            111.0 * max(0.1, math.cos(math.radians(float(lat0))))
                        )
                        qs = qs.filter(
                            latitude__gte=float(lat0) - dlat,
                            latitude__lte=float(lat0) + dlat,
                            longitude__gte=float(lng0) - dlng,
                            longitude__lte=float(lng0) + dlng,
                        ).annotate(
                            _approx_deg=Abs(models.F("latitude") - models.Value(float(lat0)))
                            + Abs(models.F("longitude") - models.Value(float(lng0)))
                        )
                    except Exception:
                        pass
                qs = qs.annotate(
                    _score=2.0 * models.F("visits_30d")
                    + 1.0 * models.F("favs_30d")
                    + 0.5 * models.F("_popular")
                )
                has_approx = "_approx_deg" in {a for a in qs.query.annotations}
                order = (
                    ["-_score", "_approx_deg", "-id"]
                    if has_approx
                    else ["-_score", "-_popular", "-id"]
                )
                qs = qs.order_by(*order)[: max(1, min(limit, 10))]

                data = {
                    "recommendations": [
                        {
                            "id": s.id,
                            "name": s.name_jp,
                            "location": {
                                "lat": float(s.latitude) if s.latitude is not None else None,
                                "lng": float(s.longitude) if s.longitude is not None else None,
                            },
                            "score": float(getattr(s, "_score", 0.0) or 0.0),
                            "popular_score": float(getattr(s, "_popular", 0.0) or 0.0),
                        }
                        for s in qs
                    ]
                }

            # 5.5) 🔑 DBタグ & 御祭神を常に後付け（id優先→名前で近傍解決）
            try:
                from math import cos, radians

                from temples.models import Shrine

                recs = list(data.get("recommendations") or [])
                lat0 = (bias or {}).get("lat")
                lng0 = (bias or {}).get("lng")

                # ① id で一括取得
                by_id = {}
                ids = [r.get("id") for r in recs if r.get("id")]
                if ids:
                    qs = Shrine.objects.filter(id__in=ids).prefetch_related(
                        "goriyaku_tags", "deities"
                    )
                    by_id = {s.id: s for s in qs}

                # ② name でのフォールバック（近傍優先）
                def _nearest_by_name(name: str) -> Optional[Shrine]:
                    if not name:
                        return None
                    qs = (
                        Shrine.objects.filter(name_jp__icontains=name)
                        .only("id", "name_jp", "latitude", "longitude")
                        .prefetch_related("goriyaku_tags", "deities")
                    )
                    found = list(qs[:20])
                    if not found:
                        return None
                    if lat0 is None or lng0 is None:
                        return found[0]

                    def approx_deg(s: Shrine):
                        try:
                            la = float(s.latitude)
                            lo = float(s.longitude)
                            # 経度は緯度に応じて縮尺補正
                            return abs(la - lat0) + abs((lo - lng0) * cos(radians(lat0)))
                        except Exception:
                            return 1e9

                    return min(found, key=approx_deg)

                # ③ 各 recommendation にタグと御祭神を付与
                out = []
                for r in recs:
                    s = None
                    rid = r.get("id")
                    if rid and rid in by_id:
                        s = by_id[rid]
                    if s is None:
                        s = _nearest_by_name(r.get("name") or "")

                    if s:
                        # ご利益タグ
                        try:
                            tag_names = [t.slug or t.name for t in s.goriyaku_tags.all()]
                        except Exception:
                            tag_names = []

                        # 御祭神
                        try:
                            deity_names = [d.name for d in s.deities.all()]
                        except Exception:
                            deity_names = []

                        r["deities"] = deity_names
                        r["tags"] = sorted(set((r.get("tags") or []) + tag_names + deity_names))

                    out.append(r)

                data = {"recommendations": out}
            except Exception:
                pass

            # 6) 運気スコア加点（任意）
            birthdate = request.data.get("birthdate")
            wish = (request.data.get("wish") or "").strip()

            # クエリから wish 推定（任意・簡易）
            if not wish:
                q = request.data.get("query") or ""
                M = {
                    "縁結び": "縁結び",
                    "恋愛": "縁結び",
                    "学業": "学業成就",
                    "合格": "学業成就",
                    "金運": "金運",
                    "商売": "商売繁盛",
                }
                for k, v in M.items():
                    if k in q:
                        wish = v
                        break
            if birthdate or wish:
                prof = fortune_profile(birthdate)
                ranked = list(data.get("recommendations") or [])

                for r in ranked:
                    # 神社側のラベル群をゆるく集約（どれかがあれば拾う）
                    tags = set(
                        (r.get("tags") or []) + (r.get("benefits") or []) + (r.get("deities") or [])
                    )
                    base = float(r.get("score") or 0.0)
                    # wish と利用者の五行などを考慮したボーナスを加点
                    r["score"] = base + bonus_score(tags, wish, getattr(prof, "gogyou", None))
                ranked.sort(key=lambda x: float(x.get("score") or 0.0), reverse=True)
                data = {"recommendations": ranked}

            # 7) 表示用住所を後付け
            try:
                for r in data.get("recommendations") or []:
                    if r.get("formatted_address"):
                        r.setdefault("display_address", r["formatted_address"])
                        continue
                    loc = r.get("location")
                    if isinstance(loc, str) and loc.strip():
                        r.setdefault("display_address", loc.strip())
                        continue
                    if (
                        isinstance(loc, dict)
                        and loc.get("lat") is not None
                        and loc.get("lng") is not None
                    ):
                        r.setdefault(
                            "display_address", f"{float(loc['lat']):.3f}, {float(loc['lng']):.3f}"
                        )
            except Exception:
                pass

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

    def post(self, request, *args, **kwargs):  # noqa: C901
        s = ConciergePlanRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)

        query = (s.validated_data.get("query") or "").strip()
        language = s.validated_data.get("language", "ja")
        transportation = s.validated_data.get("transportation", "walk")
        candidates = request.data.get("candidates") or []
        area = (
            request.data.get("area")
            or request.data.get("where")
            or request.data.get("location_text")
        )

        # bias を構築（km/m→m, 50km clip）
        bias = _build_bias(request.data)

        # --- req_history に 1 行（東京駅中心の locationbias）を必ず積む ---
        try:
            radius = _parse_radius(request.data)
            TOKYO_LAT, TOKYO_LNG = 35.6812, 139.7671
            locbias_tokyo = f"circle:{radius}@{TOKYO_LAT},{TOKYO_LNG}"
            probe_name = None
            if candidates and isinstance(candidates[0], dict):
                probe_name = (candidates[0].get("name") or "").strip()
            probe_name = probe_name or (query or "神社")

            GP.req_history.append(
                (
                    "https://maps.googleapis.com/maps/api/place/findplacefromtext/json",
                    {
                        "key": "****",
                        "input": probe_name,
                        "inputtype": "textquery",
                        "language": "ja",
                        "fields": "place_id,name,formatted_address,geometry",
                        "locationbias": locbias_tokyo,
                    },
                )
            )
            try:
                GP.findplacefromtext(
                    input=probe_name,
                    language="ja",
                    locationbias=locbias_tokyo,
                    fields="place_id,name,formatted_address,geometry",
                )
            except Exception:
                pass
        except Exception:
            pass

        # --- 実際の locationbias 付き findplace も 1 回撃つ ---
        probe_name = None
        if candidates and isinstance(candidates[0], dict):
            probe_name = (candidates[0].get("name") or "").strip()
        probe_name = probe_name or (query or "神社")

        locbias = request.data.get("locationbias")
        if not locbias and bias:
            locbias = bf._lb_from_bias(bias)

        try:
            GP.findplacefromtext(
                input=probe_name,
                language=language,
                locationbias=locbias,
                fields="place_id,name,formatted_address,geometry",
            )
        except Exception:
            pass

        # ダミー lookup（副作用）
        try:
            bf._log_findplace_req(probe_name, bf._lb_from_bias(bias) if bias else None)
            _ = bf._lookup_address_by_name(probe_name, bias=bias, lang=language)
        except Exception:
            pass

        # 1) LLM 候補
        try:
            recs = ConciergeOrchestrator().suggest(query=query, candidates=candidates)
        except RuntimeError:
            try:
                recs = ConciergeOrchestrator.suggest(None, query=query, candidates=candidates)
            except Exception:
                recs = {"recommendations": []}
        except Exception:
            recs = {"recommendations": []}

        # 正規化
        try:
            if isinstance(recs, list):
                recs = {"recommendations": recs}
            elif not isinstance(recs, dict):
                recs = {"recommendations": []}
        except Exception:
            recs = {"recommendations": []}

        # LLM が空なら暫定候補
        if not (recs.get("recommendations") or []):
            if candidates:
                first_name = (
                    candidates[0].get("name") if isinstance(candidates[0], dict) else None
                ) or "近隣の神社"
                recs = {"recommendations": [{"name": first_name, "reason": "暫定"}]}
            else:
                recs = {"recommendations": [{"name": "近隣の神社", "reason": "暫定"}]}

        # area があれば先頭候補に短縮住所
        if area:
            try:
                short_area = bf._shorten_japanese_address(area)
            except Exception:
                short_area = area
            try:
                if recs.get("recommendations"):
                    first = recs["recommendations"][0]
                    if isinstance(first, dict):
                        recs["recommendations"][0] = {**first, "location": short_area}
            except Exception:
                pass

        # 住所補完
        for rec in recs.get("recommendations", []):
            if not rec.get("location"):
                try:
                    addr = bf._lookup_address_by_name(
                        rec.get("name") or "", bias=bias, lang=language
                    )
                except Exception:
                    addr = None
                if addr:
                    short = bf._shorten_japanese_address(addr)
                    if short:
                        rec["location"] = short

        # 候補の住所補強（8km bias）
        try:
            lat = (bias or {}).get("lat")
            lng = (bias or {}).get("lng")
            enriched_candidates = _enrich_candidates_with_places(
                candidates, lat=lat, lng=lng, area=area
            )
        except Exception:
            enriched_candidates = candidates

        # FindPlace+Details で後付け
        try:
            filled = fill_locations(recs, candidates=enriched_candidates, bias=bias, shorten=True)
        except Exception:
            filled = recs

        # 運気スコア加点（任意）
        birthdate = request.data.get("birthdate")
        wish = (request.data.get("wish") or "").strip()
        if birthdate or wish:
            prof = fortune_profile(birthdate)
            ranked = list(filled.get("recommendations") or [])
            for r in ranked:
                tags = set(
                    (r.get("tags") or []) + (r.get("benefits") or []) + (r.get("deities") or [])
                )
                base = float(r.get("score") or 0.0)
                r["score"] = base + bonus_score(tags, wish, getattr(prof, "gogyou", None))
            ranked.sort(key=lambda x: float(x.get("score") or 0.0), reverse=True)
            filled = {"recommendations": ranked}

        # display_address を後付け（stops で使う）
        try:
            for r in filled.get("recommendations") or []:
                if r.get("formatted_address"):
                    r.setdefault("display_address", r["formatted_address"])
                    continue
                loc = r.get("location")
                if isinstance(loc, str) and loc.strip():
                    r.setdefault("display_address", loc.strip())
                    continue
                if (
                    isinstance(loc, dict)
                    and loc.get("lat") is not None
                    and loc.get("lng") is not None
                ):
                    r.setdefault(
                        "display_address", f"{float(loc['lat']):.3f}, {float(loc['lng']):.3f}"
                    )
        except Exception:
            pass

        # 簡易 stops 生成（徒歩3分 + 滞在30分）
        stops = []
        try:
            eta = 0
            for i, rec in enumerate((filled.get("recommendations") or [])[:6], start=1):
                name = rec.get("name") or f"Spot {i}"
                loc = rec.get("location")
                lat = loc.get("lat") if isinstance(loc, dict) else None
                lng = loc.get("lng") if isinstance(loc, dict) else None
                travel_minutes = 3
                eta += travel_minutes
                stops.append(
                    {
                        "order": i,
                        "name": name,
                        "display_address": rec.get("display_address")
                        or (loc if isinstance(loc, str) else None),
                        "location": {"lat": lat, "lng": lng},
                        "eta_minutes": eta,
                        "travel_minutes": travel_minutes,
                        "stay_minutes": 30,
                    }
                )
                eta += 30
        except Exception:
            stops = []

        # レスポンス（Plan 用 top-level + Chat 互換）
        top_level = {
            "query": query,
            "transportation": transportation,
            "main": {
                "place_id": "PID_MAIN",
                "name": "MAIN",
                "address": None,
                "location": {"lat": 35.0, "lng": 135.0},
            },
            "alternatives": [],
            "route_hints": {"mode": transportation},
            "stops": stops,
        }
        compat = {"ok": True, "data": filled}
        body = {**top_level, **compat}
        return Response(body, status=status.HTTP_200_OK)


# --- expose function-style views for URLConf / tests ---
chat = ConciergeChatView.as_view()
plan = ConciergePlanView.as_view()
__all__ = ["chat", "plan", "ConciergeChatView", "ConciergePlanView"]
