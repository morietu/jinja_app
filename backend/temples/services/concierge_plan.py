# backend/temples/services/concierge_plan.py
from __future__ import annotations

# =========================================================
# Imports
# =========================================================
import logging
import os
import re
from typing import Any, Dict, Optional

from django.conf import settings
from temples.domain.fortune import fortune_profile
from temples.domain.match import bonus_score
from temples.domain.wish_map import get_hints_for_wish, match_wish_from_query
from temples.geocoding.client import geocode_google_point
from temples.llm import backfill as bf
from temples.services import places as Places
from temples.services.billing_state import recommend_limit_for_user
from temples.services.concierge_explanations import attach_explanations_for_plan

logger = logging.getLogger(__name__)

# =========================================================
# Constants (推し文生成用)
# =========================================================
WISH_HINTS = [
    ("縁結び", "良縁成就を願う参拝に"),
    ("恋愛", "恋愛成就の祈りに"),
    ("学業", "学業成就・合格祈願に"),
    ("金運", "金運上昇・商売繁盛を祈る参拝に"),
    ("厄除", "厄除け・心身清めの参拝に"),
    ("厄払い", "厄除け・心身清めの参拝に"),
]

TAG_DEITY_HINTS: Dict[str, str] = {
    "大国主": "縁結びにご利益",
    "少彦名": "健康長寿の祈りに",
    "木花咲耶姫": "安産・子授けの祈りに",
    "応神天皇": "勝運・出世運に",
    "歓喜天": "夫婦和合・福徳に",
    "観音": "所願成就・厄除けに",
    "観音菩薩": "所願成就・厄除けに",
    "学業成就": "学業成就の祈りに",
    "金運": "金運上昇を願う参拝に",
    "商売繁盛": "商売繁盛を祈る参拝に",
}


# =========================================================
# Helpers: radius / bias / places
# =========================================================
def _parse_radius(data: Dict[str, Any]) -> int:
    """serializerで正規化済みの radius_m を使う（既定 8000、1..50000 にクリップ）"""
    rm = data.get("radius_m")
    try:
        r = int(float(rm)) if rm is not None else 8000
    except Exception:
        r = 8000
    return max(1, min(50000, r))


def _build_bias(data: Dict[str, Any]) -> Optional[Dict[str, float]]:
    lat = data.get("lat")
    lng = data.get("lng")
    area_text = (data.get("area_resolved") or "").strip()

    # area がある & lat/lng が無いなら geocoding client で解決する
    if area_text and (lat is None or lng is None):
        pt = geocode_google_point(area_text, language="ja", region="jp", timeout=6.0)
        if pt:
            lat, lng = pt

    if lat is None or lng is None:
        return None

    try:
        lat = float(lat)
        lng = float(lng)
    except Exception:
        return None

    r_m = _parse_radius(data)
    return {"lat": lat, "lng": lng, "radius": r_m, "radius_m": r_m}


def _coords_from_locationbias(lb: str | None) -> tuple[float, float] | None:
    """
    locationbias 形式（例: "circle:5000@35.6812,139.7671"）から (lat, lng) を抽出
    """
    if not lb:
        return None
    m = re.search(r"@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)", str(lb))
    if not m:
        return None
    try:
        return float(m.group(1)), float(m.group(2))
    except Exception:
        return None


def _apply_cost_guarded_place_enrichment(
    *,
    filled: Dict[str, Any],
    area: Optional[str],
    language: str,
    locbias: Optional[str],
    disable_places: bool,
) -> Dict[str, Any]:
    """
    Plan向け Places 最終補完（課金防衛版）。
    - disable時は何もしない
    - 最大 lookup 数を制限
    - 1件座標を確保したら追加 lookup を止める
    """
    if disable_places:
        return filled

    try:
        patched: list[dict] = []

        max_place_lookups = int(os.getenv("PLAN_MAX_PLACE_LOOKUPS", "2"))
        if max_place_lookups <= 0:
            logger.info("[plan] places_budget max=%d done=0 got_coords=0", max_place_lookups)
            return filled
        lookups_done = 0
        cache: dict[str, dict] = {}
        got_coords = 0

        for r in filled.get("recommendations") or []:
            # 🔒 文字列locationを固定したいrecは補完対象外
            if r.get("_lock_text_loc") and isinstance(r.get("location"), str):
                patched.append(r)
                continue

            # すでに座標あり
            loc = r.get("location")
            if isinstance(loc, dict) and loc.get("lat") is not None and loc.get("lng") is not None:
                got_coords += 1
                patched.append(r)
                continue

            # 既に1件座標確保済みなら追加lookupしない（最低1stop運用）
            if got_coords >= 1:
                patched.append(r)
                continue

            # lookup上限超過なら叩かない
            if lookups_done >= max_place_lookups:
                patched.append(r)
                continue

            probe = (r.get("name") or "").strip()
            if area:
                probe = f"{probe} {area}".strip()

            if not probe:
                patched.append(r)
                continue

            # キャッシュヒット
            if probe in cache:
                res = cache[probe]
            else:
                try:
                    res = Places.findplacefromtext(
                        input=probe,
                        language=language,
                        locationbias=locbias,
                        fields="place_id,name,formatted_address,geometry",
                    )
                    cache[probe] = res
                    lookups_done += 1
                except Exception:
                    res = None

            try:
                cand = (res.get("candidates") or [{}])[0] if isinstance(res, dict) else {}
                g2 = (cand.get("geometry") or {}).get("location") or {}
                lat2, lng2 = g2.get("lat"), g2.get("lng")

                if lat2 is not None and lng2 is not None:
                    r["location"] = {"lat": float(lat2), "lng": float(lng2)}
                    got_coords += 1

                if not r.get("display_address"):
                    addr = cand.get("formatted_address")
                    if addr:
                        r["display_address"] = bf._shorten_japanese_address(addr) or addr
            except Exception:
                pass

            patched.append(r)

        logger.info(
            "[plan] places_budget max=%d done=%d got_coords=%d",
            max_place_lookups,
            lookups_done,
            got_coords,
        )
        out = dict(filled)
        out["recommendations"] = patched
        return out
    except Exception:
        return filled


# =========================================================
# Helpers: display / fallback / reason
# =========================================================
def _short_area(area: str | None) -> str | None:
    if not area:
        return area
    try:
        return bf._shorten_japanese_address(area) or area
    except Exception:
        return area


def _clean_display_name(name: Any) -> str:
    if not isinstance(name, str):
        return str(name)
    n = name.replace("(ダミー)", "").replace("（ダミー）", "")
    return n.strip()


def _append_fallback_if_needed(
    recs_all: list[dict],
    bias: Optional[Dict[str, float]],
    area: Optional[str],
    has_any_coords: bool,
    has_any_text_lock: bool,
) -> None:
    """
    座標を持つ候補が1件もなく、biasだけある場合に
    「この周辺」のfallbackエントリを recs_all に追加する。

    ※ stops 生成は座標の有無で決まる（_is_fallback では除外していない）
    """
    blat = (bias or {}).get("lat")
    blng = (bias or {}).get("lng")
    has_bias = blat is not None and blng is not None

    if has_any_coords or not has_bias or has_any_text_lock:
        return

    short = _short_area(area)
    fallback_label = short or "この周辺"
    fallback_addr = short or f"{float(blat):.3f}, {float(blng):.3f}"

    recs_all.append(
        {
            "name": fallback_label,
            "display_name": fallback_label,
            "display_address": fallback_addr,
            "location": {"lat": float(blat), "lng": float(blng)},
            "reason": "近くを散策したいときに",
            "_is_fallback": True,  # ソートで末尾固定するためのフラグ
        }
    )


def _is_noise_reason(text: str, name: str, tags_concat: str) -> bool:
    if not text:
        return False
    low = text.strip().lower()
    if any(x in low for x in ("no ", "n/a", "tags", "deities")):
        return True
    if low in ("暫定", "placeholder") or low.startswith("暫定"):
        return True
    if text == name or (name and text.replace(" ", "") == name.replace(" ", "")):
        return True
    if len(text) <= 6 and text in tags_concat:
        return True
    if ("," in text or "、" in text) and len(text) < 20:
        return True
    return False


def _hint_from_tags(tags: set[str]) -> str | None:
    for k, hint in TAG_DEITY_HINTS.items():
        if any(k in s for s in tags):
            return hint
    return None


def _hint_from_query(query: str) -> str | None:
    for key, hint in WISH_HINTS:
        if key in (query or ""):
            return hint
    return None


def _hint_from_wish_map(query: str) -> str | None:
    try:
        wish_key = match_wish_from_query(query or "")
    except Exception:
        wish_key = None
    if not wish_key:
        return None
    hints = get_hints_for_wish(wish_key) or []
    return hints[0] if hints else None


def _generic_by_popular(popular: float) -> str:
    if popular >= 7:
        return "参拝者が多く評判の社"
    if popular >= 4:
        return "地域で親しまれる社"
    return "静かに手を合わせたい社"


def _normalize_reason(rec: dict, *, query: str) -> str:
    name = (rec.get("name") or "").strip()
    raw = rec.get("reason")
    t = raw.strip() if isinstance(raw, str) else ""
    tags_list = [
        str(x) for x in ((rec.get("tags") or []) + (rec.get("deities") or [])) if x is not None
    ]
    tags = set(tags_list)
    try:
        popular = float(rec.get("popular_score") or 0)
    except Exception:
        popular = 0.0

    if t and t in TAG_DEITY_HINTS:
        t = TAG_DEITY_HINTS[t]
    if _is_noise_reason(t, name, "".join(tags_list)):
        t = ""

    if not t:
        t = _hint_from_tags(tags) or ""
    if not t:
        t = _hint_from_query(query) or ""
    if not t:
        t = _hint_from_wish_map(query) or ""

    if not t:
        t = _generic_by_popular(popular)

    t = t[:30] if len(t) > 30 else t
    return t or "静かに手を合わせたい社"


# =========================================================
# Helpers: dedupe
# =========================================================
def normalize_name_key(name: str) -> str:
    if not name:
        return ""
    n = name.strip()
    n = n.replace("（", "(").replace("）", ")").lower()
    n = re.sub(r"\s|・|-", "", n)
    n = n.replace("(", "").replace(")", "")
    n = re.sub(r"^[一-龠々〆ヵヶ]+山", "", n)
    n = re.sub(
        r"(神社|大社|神宮|宮|八幡宮|天満宮|稲荷神社|稲荷|寺|院|観音|大師|不動尊|堂|社)$", "", n
    )
    aliases = {
        "浅草観音": "浅草寺",
        "金龍山浅草寺": "浅草寺",
        "伏見稲荷大社": "伏見稲荷",
    }
    return aliases.get(n, n)


def dedupe_recommendations(recs: list[dict]) -> list[dict]:
    seen: dict[str, dict] = {}
    for r in recs:
        key = normalize_name_key(r.get("name") or "")
        if not key:
            continue
        prev = seen.get(key)
        if not prev or (r.get("score", 0) > prev.get("score", 0)):
            seen[key] = r
    return list(seen.values())


# =========================================================
# Main: build response
# =========================================================
def build_plan_response(  # noqa: C901
    *,
    request_data: Dict[str, Any],
    serializer_validated: Dict[str, Any],
    user=None,
) -> Dict[str, Any]:
    """
    ConciergePlanView.post のロジックを移植して body を返す。
    top_level + compat(ok/data) まで含める（挙動は変えない）。
    """
    query = (serializer_validated.get("query") or "").strip()
    language = serializer_validated.get("language", "ja")
    transportation = serializer_validated.get("transportation", "walk")

    candidates = request_data.get("candidates") or []
    area = (serializer_validated.get("area_resolved") or "").strip() or None

    # bias を構築（serializerが正規化した値を前提）
    bias = _build_bias(serializer_validated)

    no_material = not candidates and not area and not bias

    # ==== 5km 安定化: ここで locbias を一度だけ決めて固定 ====
    locbias_fixed = serializer_validated.get("locationbias")

    DISABLE_PLACES = os.getenv("PLAN_DISABLE_PLACES", "0") == "1"

    # candidates/area/bias が全部無い時だけ Places を止める
    if no_material:
        DISABLE_PLACES = True

    # locationbias は外部入力がなければ bias から作る（固定値ハックは撤去）
    if not locbias_fixed and bias:
        try:
            locbias_fixed = bf._lb_from_bias(bias)
        except Exception:
            locbias_fixed = None

    # 1) LLM 候補（monkeypatch が効くよう "遅延 import"）
    use_llm = bool(getattr(settings, "CONCIERGE_USE_LLM", False))
    if use_llm:
        try:
            from temples.llm.orchestrator import ConciergeOrchestrator as Orchestrator

            recs = Orchestrator().suggest(query=query, candidates=candidates)
        except Exception:
            recs = {"recommendations": []}
    else:
        recs = {"recommendations": []}

    # 正規化
    try:
        if isinstance(recs, list):
            recs = {"recommendations": recs}
        elif not isinstance(recs, dict):
            recs = {"recommendations": []}
    except Exception:
        recs = {"recommendations": []}

    # LLM が空なら candidates をそのまま recommendations にする（Planは候補が真実）
    if not no_material and not (recs.get("recommendations") or []):
        cands = [c for c in (candidates or []) if isinstance(c, dict)]
        if cands:
            recs = {
                "recommendations": [
                    {"name": (c.get("name") or c.get("place_id") or "近隣の神社"), "reason": ""}
                    for c in cands
                ]
            }
        elif area or bias:
            # area がある or bias があるなら最低限のダミーは許容（Places probe にもなる）
            recs = {"recommendations": [{"name": "近隣の神社", "reason": ""}]}
        else:
            recs = {"recommendations": []}

    # ---- (1) area があれば先頭候補に短縮住所を display に入れ、必要なら location を文字列＋ロック ----
    lock_applied = False
    if area:
        short_area = _short_area(area)
        try:
            if recs.get("recommendations"):
                first = recs["recommendations"][0]
                if isinstance(first, dict):
                    first = {**first, "display_address": short_area}
                    if not isinstance(first.get("location"), dict):
                        first["location"] = short_area
                        first["_lock_text_loc"] = True
                        lock_applied = True
                    recs["recommendations"][0] = first
        except Exception:
            pass

    # Places 呼び出しは「課金防衛版」(2) に一本化するため、
    # ここでは fill_locations / candidate_enrich を使わない。
    filled = recs

    # --- (1') 保険 ---
    try:
        if area:
            short_area = _short_area(area)
            if filled.get("recommendations"):
                first = filled["recommendations"][0]
                if isinstance(first, dict):
                    first.setdefault("display_address", short_area)
                    if lock_applied:
                        first["location"] = short_area
                        first["_lock_text_loc"] = True
    except Exception:
        pass

    try:
        filled["recommendations"] = dedupe_recommendations(filled.get("recommendations") or [])
    except Exception:
        pass

    # 暫定/placeholder → 空理由に
    try:
        for r in filled.get("recommendations") or []:
            if str(r.get("reason") or "").strip().lower() in ("暫定", "placeholder"):
                r["reason"] = ""
    except Exception:
        pass

    # 運気スコア加点（任意）
    birthdate = request_data.get("birthdate")
    wish = (request_data.get("wish") or "").strip()
    if birthdate or wish:
        prof = fortune_profile(birthdate)
        ranked = list(filled.get("recommendations") or [])
        for r in ranked:
            tags = set((r.get("tags") or []) + (r.get("benefits") or []) + (r.get("deities") or []))
            base = float(r.get("score") or 0.0)
            r["score"] = base + bonus_score(tags, wish, getattr(prof, "gogyou", None))
        ranked.sort(key=lambda x: float(x.get("score") or 0.0), reverse=True)
        filled = {"recommendations": ranked}

    # display_address / display_name 付与 & 理由の最終正規化
    try:
        for r in filled.get("recommendations") or []:
            r["reason"] = _normalize_reason(r, query=query)

            if r.get("name"):
                cleaned = _clean_display_name(r["name"])
                r["display_name"] = cleaned
                r["name"] = cleaned

            if r.get("formatted_address"):
                r.setdefault("display_address", r["formatted_address"])
                continue
            loc = r.get("location")
            if isinstance(loc, str) and loc.strip():
                r.setdefault("display_address", loc.strip())
                continue
            if isinstance(loc, dict) and loc.get("lat") is not None and loc.get("lng") is not None:
                r.setdefault("display_address", f"{float(loc['lat']):.3f}, {float(loc['lng']):.3f}")
    except Exception:
        pass

    # --- (2) 座標の最終補完：課金防衛版 ---
    filled = _apply_cost_guarded_place_enrichment(
        filled=filled,
        area=area,
        language=language,
        locbias=locbias_fixed,
        disable_places=DISABLE_PLACES,
    )

    limit = recommend_limit_for_user(user)
    recs_all = list(filled.get("recommendations") or [])

    def _has_coords(r: dict) -> bool:
        loc = r.get("location")
        return (
            isinstance(loc, dict) and (loc.get("lat") is not None) and (loc.get("lng") is not None)
        )

    def _has_text_loc_lock(r: dict) -> bool:
        return bool(
            r.get("_lock_text_loc")
            and isinstance(r.get("location"), str)
            and r.get("location").strip()
        )

    # 座標あり優先（fallbackは最後）
    def _sort_key(r: dict) -> tuple:
        return (
            1 if r.get("_is_fallback") else 0,  # fallbackは最後
            0 if _has_coords(r) else 1,  # 次に座標あり優先
        )

    recs_all.sort(key=_sort_key)

    # --- fallback候補を必要なら追加（座標なし・bias有り・text_lockなし のとき）---
    has_any_coords = any(_has_coords(r) for r in recs_all)
    has_any_text_lock = any(_has_text_loc_lock(r) for r in recs_all)
    _append_fallback_if_needed(recs_all, bias, area, has_any_coords, has_any_text_lock)

    # 追加後にもう一回ソート（fallback末尾を確実に）
    recs_all.sort(key=_sort_key)

    # ✅ 最後に limit
    filled["recommendations"] = recs_all[:limit]

    # ✅ explanation を付与（フロント統一のため）
    try:
        filled = attach_explanations_for_plan(
            filled,
            query=query,
            area=area,
            bias=bias,
            birthdate=request_data.get("birthdate"),
            wish=(request_data.get("wish") or "").strip() or None,
        )
    except Exception as e:
        logger.exception("[plan] attach_explanations failed: %s", e)
        pass

    # 簡易 stops 生成（徒歩3分 + 滞在30分）
    stops = []
    try:
        eta = 0
        order = 0
        recs_limited = filled.get("recommendations") or []

        for rec in recs_limited:
            name = rec.get("display_name") or _clean_display_name(rec.get("name") or "Spot")
            loc = rec.get("location")
            rlat = loc.get("lat") if isinstance(loc, dict) else None
            rlng = loc.get("lng") if isinstance(loc, dict) else None

            # ★ stops は座標必須（無いものは候補として残し、stops からは落とす）
            if rlat is None or rlng is None:
                continue

            order += 1
            travel_minutes = 3
            eta += travel_minutes

            disp = rec.get("display_address") or f"{rlat:.3f}, {rlng:.3f}"

            stops.append(
                {
                    "order": order,
                    "name": name,
                    "display_address": disp,
                    "location": {"lat": rlat, "lng": rlng},
                    "eta_minutes": eta,
                    "travel_minutes": travel_minutes,
                    "stay_minutes": 30,
                }
            )
            eta += 30
    except Exception:
        stops = []

    # ✅ 最終保険：ここまで来て stops が空なら必ず1個作る
    if not stops:
        blat = (bias or {}).get("lat")
        blng = (bias or {}).get("lng")

        # 1) bias があれば従来どおり
        if blat is not None and blng is not None:
            short = _short_area(area)
            fallback_label = short or "この周辺"
            fallback_addr = short or f"{blat:.3f}, {blng:.3f}"
            stops = [
                {
                    "order": 1,
                    "name": fallback_label,
                    "display_address": fallback_addr,
                    "location": {"lat": blat, "lng": blng},
                    "eta_minutes": 3,
                    "travel_minutes": 3,
                    "stay_minutes": 30,
                }
            ]
        else:
            # 2) bias が無いなら locbias_fixed から座標復元して作る（5km固定でも効く）
            pt = _coords_from_locationbias(locbias_fixed)
            if pt:
                lat0, lng0 = pt
                short = _short_area(area)
                fallback_label = short or "この周辺"
                fallback_addr = short or f"{lat0:.3f}, {lng0:.3f}"
                stops = [
                    {
                        "order": 1,
                        "name": fallback_label,
                        "display_address": fallback_addr,
                        "location": {"lat": lat0, "lng": lng0},
                        "eta_minutes": 3,
                        "travel_minutes": 3,
                        "stay_minutes": 30,
                    }
                ]

    main_loc = {"lat": 35.0, "lng": 135.0}
    if (bias or {}).get("lat") is not None and (bias or {}).get("lng") is not None:
        main_loc = {"lat": float(bias["lat"]), "lng": float(bias["lng"])}
    else:
        pt0 = _coords_from_locationbias(locbias_fixed)
        if pt0:
            main_loc = {"lat": pt0[0], "lng": pt0[1]}

    top_level = {
        "query": query,
        "transportation": transportation,
        "main": {
            "place_id": "PID_MAIN",
            "name": "MAIN",
            "address": None,
            "location": main_loc,
        },
        "alternatives": [],
        "route_hints": {"mode": transportation},
        "stops": stops,
    }

    compat = {"ok": True, "data": filled}
    body = {**top_level, **compat}
    return body
