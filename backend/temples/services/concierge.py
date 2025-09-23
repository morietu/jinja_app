from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Literal, Optional, TypedDict

from .places import places_client  # ← 統一して使う

log = logging.getLogger(__name__)

MAX_RADIUS_M = 50_000


def _calc_radius_m(*, radius_m: Optional[int], radius_km: Optional[float]) -> int:
    if radius_km is not None:
        return int(radius_km * 1000)
    if radius_m is not None:
        return min(int(radius_m), MAX_RADIUS_M)
    return 3000  # デフォルト 3km


def _locationbias(lat: float, lng: float, radius_m: int) -> str:
    return f"circle:{radius_m}@{lat},{lng}"


def _short_label_from_details(details: Dict[str, Any]) -> Optional[str]:
    comps = details.get("address_components", []) or []

    def _get(types: List[str]) -> Optional[str]:
        for t in types:
            c = next((c for c in comps if t in c.get("types", [])), None)
            if c:
                return c.get("short_name") or c.get("long_name")
        return None

    locality = _get(["locality", "administrative_area_level_2"])
    sublocal = _get(["sublocality", "sublocality_level_1"])

    if locality and sublocal:
        return f"{locality}{sublocal}"
    if locality:
        return locality

    fmt = details.get("formatted_address")
    if fmt and " " not in fmt:
        return fmt[:6]
    return None


# ---- Types -------------------------------------------------------------------
Mode = Literal["walk", "car"]


class ShrineCandidate(TypedDict):
    name: str
    area_hint: str
    reason: str


class PlanResult(TypedDict):
    mode: Mode
    main: ShrineCandidate
    nearby: List[ShrineCandidate]


# ---- AI(ダミー) --------------------------------------------------------------
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

SYSTEM_PROMPT = """あなたは神社参拝のコンシェルジュです。
入力（現在地/ご利益/移動手段/所要時間）から、参拝ルート案（メイン1＋近隣2）を日本語で考えます。
ただし出力はアプリ側でPlace正規化するため、名称・エリア目安・理由の3点だけをJSONで返すこと。
"""


def make_plan_dummy(benefit: str, mode: Mode) -> PlanResult:
    return {
        "mode": mode,
        "main": {
            "name": "浅草神社",
            "area_hint": "浅草 台東区",
            "reason": f"{benefit}で人気",
        },
        "nearby": [
            {
                "name": "浅草寺",
                "area_hint": "浅草 台東区",
                "reason": "同エリアで回遊しやすい",
            },
            {"name": "今戸神社", "area_hint": "台東区 近隣", "reason": "縁結びで有名"},
        ],
    }


def make_plan(
    current_lat: Optional[float],
    current_lng: Optional[float],
    benefit: str,
    mode: Mode,
    time_limit: Optional[str] = None,
) -> PlanResult:
    if not OPENAI_API_KEY:
        return make_plan_dummy(benefit, mode)
    return make_plan_dummy(benefit, mode)


# ---- Concierge Service -------------------------------------------------------
class ConciergeService:
    def __init__(self):
        # 統一：places_client を直接使う
        self.places = places_client

    def _route_mode_from_ui(self, mode: Mode) -> Literal["walk", "drive"]:
        return "walk" if mode == "walk" else "drive"

    # temples/services/concierge.py

    def build_plan(
        self, *, query: str, language: str, locationbias: str, transportation: str
    ) -> Dict[str, Any]:
        # 1) Find Place（tests が self.places.find_place をモックする想定）
        fp = self.places.find_place(
            input=query,
            language=language,
            locationbias=locationbias,
            fields="place_id,name,formatted_address,geometry",
        )
        fp_candidates = fp.get("candidates") or fp.get("results") or []
        if not fp_candidates:
            ui_mode: Mode = transportation if transportation in ("walk", "car") else "walk"
            return {
                "query": query,
                "transportation": ui_mode,
                "main": None,
                "alternatives": [],
                "route_hints": {
                    "mode": self._route_mode_from_ui(ui_mode),
                    "waypoints": [],
                },
            }

        # ★★★ ここから【あなたの差分】に置き換え ★★★
        cand = fp_candidates[0]
        place_id = cand.get("place_id")
        # まず候補から取り出す（lat/lng が無い等の不足だけ Details で補完）
        name = cand.get("name")
        addr = cand.get("formatted_address") or cand.get("address")
        gloc = (cand.get("geometry") or {}).get("location") or {}
        lat = cand.get("lat") if cand.get("lat") is not None else gloc.get("lat")
        lng = cand.get("lng") if cand.get("lng") is not None else gloc.get("lng")
        rating = cand.get("rating")
        reviews = cand.get("user_ratings_total")
        icon = cand.get("icon")

        # 不足があれば Details で補完（失敗しても落とさない）
        if (lat is None or lng is None or addr is None) and place_id:
            try:
                det = self.places.details(
                    place_id=place_id,
                    language=language,
                    fields="place_id,name,formatted_address,geometry,rating,user_ratings_total,photos,icon",
                )
                res_det = det.get("result") or det
                if addr is None:
                    addr = res_det.get("formatted_address") or addr
                dloc = (res_det.get("geometry") or {}).get("location") or {}
                lat = lat if lat is not None else dloc.get("lat")
                lng = lng if lng is not None else dloc.get("lng")
                rating = rating if rating is not None else res_det.get("rating")
                reviews = reviews if reviews is not None else res_det.get("user_ratings_total")
                icon = icon if icon is not None else res_det.get("icon")
            except Exception:
                pass  # そのまま候補だけで続行

        # main 用の統一フォーマット
        main_fmt = {
            "place_id": place_id,
            "name": name,
            "address": addr,
            "location": {"lat": lat, "lng": lng},
            "rating": rating,
            "user_ratings_total": reviews,
            "icon": icon,
        }
        # ★★★ ここまで差分 ★★★

        # 2) 周辺検索（place_of_worship で包括）
        center = f"{main_fmt['location']['lat']},{main_fmt['location']['lng']}"
        nearby = self.places.nearby_search(
            location=center,
            radius=1500,
            language=language,
            type="place_of_worship",
        )

        alts: List[Dict[str, Any]] = []
        if nearby and nearby.get("results"):
            items = [r for r in nearby["results"] if r.get("place_id") != main_fmt["place_id"]]

            def _safe_float(v: Any, default: float = 0.0) -> float:
                try:
                    return float(v)
                except Exception:
                    return default

            items.sort(
                key=lambda r: (
                    -_safe_float(r.get("rating")),
                    _safe_float(r.get("distance_m"), 1e9),
                )
            )
            for r in items[:2]:
                gl = (r.get("geometry") or {}).get("location") or {}
                alts.append(
                    {
                        "place_id": r.get("place_id"),
                        "name": r.get("name"),
                        "address": r.get("vicinity") or r.get("formatted_address"),
                        "location": {"lat": gl.get("lat"), "lng": gl.get("lng")},
                        "rating": r.get("rating"),
                        "user_ratings_total": r.get("user_ratings_total"),
                    }
                )

        # 3) ルートヒント
        ui_mode: Mode = transportation if transportation in ("walk", "car") else "walk"
        return {
            "query": query,
            "transportation": ui_mode,
            "main": main_fmt,
            "alternatives": alts,
            "route_hints": {
                "mode": self._route_mode_from_ui(ui_mode),
                "waypoints": [
                    {
                        "type": "destination",
                        "place_id": main_fmt["place_id"],
                        "lat": main_fmt["location"]["lat"],
                        "lng": main_fmt["location"]["lng"],
                    }
                ],
            },
        }
