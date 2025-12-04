# backend/temples/api_views_concierge.py
import logging
import os
import re
from typing import Any, Dict, List, Optional

import requests
from django.conf import settings
from drf_spectacular.utils import OpenApiTypes, extend_schema
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from temples.domain.fortune import fortune_profile
from temples.domain.match import bonus_score
from temples.domain.wish_map import get_hints_for_wish, match_wish_from_query
from temples.llm import backfill as bf
from temples.llm.backfill import fill_locations
from temples.llm.orchestrator import ConciergeOrchestrator
from temples.recommendation.llm_adapter import get_llm_adapter
from temples.serializers.concierge import ConciergePlanRequestSerializer
from temples.services import google_places as GP
from temples.services.concierge_history import append_chat

from .models import ConciergeUsage



llm = get_llm_adapter(
    provider=settings.LLM_PROVIDER,
    model=settings.LLM_MODEL,
    timeout_ms=settings.LLM_TIMEOUT_MS,
    prompts_dir=settings.LLM_PROMPTS_DIR,
    enabled=settings.USE_LLM_CONCIERGE,
    temperature=settings.LLM_TEMPERATURE,
    max_tokens=settings.LLM_MAX_TOKENS,
    base_url=settings.LLM_BASE_URL or None,
    force_chat=settings.LLM_FORCE_CHAT,
    force_json=settings.LLM_FORCE_JSON,
    retries=settings.LLM_RETRIES,
    backoff_s=settings.LLM_BACKOFF_S,
)

log = logging.getLogger(__name__)

# ===== 推し文生成用の定数 =====
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
WISH_SYNONYMS: Dict[str, List[str]] = {
    "縁結び": ["良縁成就を願う参拝に", "恋愛成就の祈りに", "ご縁を結ぶ祈願に"],
    "学業": ["学業成就・合格祈願に", "学力向上を願う参拝に"],
    "金運": ["金運上昇を願う参拝に", "商売繁盛を祈る参拝に"],
    "厄除": ["厄除け・心身清めの参拝に", "災難除けの祈りに", "厄払いの祈りに"],
}


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


def _short_area(area: str | None) -> str | None:
    if not area:
        return area
    try:
        return bf._shorten_japanese_address(area) or area
    except Exception:
        return area


def _clean_display_name(name: str) -> str:
    """(ダミー)などの補助フラグを表示から外す"""
    if not isinstance(name, str):
        return str(name)
    n = name.replace("(ダミー)", "").replace("（ダミー）", "")
    return n.strip()


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
    """短文の“推し文”を最終整形。DB/LLM/固定文の混在に耐える。"""
    name = (rec.get("name") or "").strip()
    raw = rec.get("reason")
    t = raw.strip() if isinstance(raw, str) else ""
    tags_list = (rec.get("tags") or []) + (rec.get("deities") or [])
    tags = set(tags_list)
    popular = float(rec.get("popular_score") or 0)

    # 1) ノイズ除去／キー直接一致置換
    if t and t in TAG_DEITY_HINTS:
        t = TAG_DEITY_HINTS[t]
    if _is_noise_reason(t, name, "".join(tags_list)):
        t = ""

    # 2) タグ→ 3) クエリ→ 4) wish_map の順でヒント
    if not t:
        t = _hint_from_tags(tags) or ""
    if not t:
        t = _hint_from_query(query) or ""
    if not t:
        t = _hint_from_wish_map(query) or ""

    # 5) 人気スコアの汎用文
    if not t:
        t = _generic_by_popular(popular)

    t = t[:30] if len(t) > 30 else t
    return t or "静かに手を合わせたい社"


def normalize_name_key(name: str) -> str:
    if not name:
        return ""
    # 正規化：大文字小文字/全角半角・括弧・スペース・中点など
    n = name.strip()
    n = n.replace("（", "(").replace("）", ")").lower()
    n = re.sub(r"\s|・|-", "", n)
    n = n.replace("(", "").replace(")", "")
    # 山号（○○山…）の除去（例：金龍山浅草寺→浅草寺）
    n = re.sub(r"^[一-龠々〆ヵヶ]+山", "", n)
    # 末尾の宗教施設接尾辞を除去（広めに）
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
    seen = {}
    for r in recs:
        key = normalize_name_key(r.get("name") or "")
        if not key:
            continue
        prev = seen.get(key)
        if not prev or (r.get("score", 0) > prev.get("score", 0)):
            seen[key] = r
    return list(seen.values())




class ConciergeChatView(APIView):
    # authentication_classes = []  # ← 明示無効化はやめる（デフォルト認証を使う）
    permission_classes = [AllowAny]
    throttle_scope = "concierge"

    @extend_schema(
        summary="Concierge chat",
        description="フリーテキストの希望（query）等から神社候補をレコメンドします。",
        request=OpenApiTypes.OBJECT,  # 可変ペイロードのためまずはざっくり
        responses={200: OpenApiTypes.OBJECT},  # {"ok": bool, "data": {"recommendations": [...]}}
        tags=["concierge"],
    )
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

        # --- 利用回数チェック（認証ユーザーのみカウント） --------------------
        user = request.user if request.user.is_authenticated else None
        today = timezone.localdate()
        daily_limit = getattr(settings, "CONCIERGE_DAILY_FREE_LIMIT", 5)

        usage: ConciergeUsage | None = None

        if user is not None:
            usage, _ = ConciergeUsage.objects.get_or_create(
                user=user,
                date=today,
            )

            # 上限到達 → LLM / ダミーロジックに入る前に早期 return
            if usage.count >= daily_limit:
                dummy = {
                    "id": 0,
                    "name": "おすすめの神社",
                    "display_name": "おすすめの神社",
                    "location": None,
                    "score": 0.0,
                    "popular_score": 0.0,
                    "tags": [],
                    "deities": [],
                    "reason": "静かに手を合わせたい社",
                    "__dummy": True,
                }
                body: dict[str, Any] = {
                    "ok": True,
                    "data": {"recommendations": [dummy]},
                    "reply": "無料で利用できる回数を使い切りました。",
                    "note": "有料プランに登録すると、引き続きAIコンシェルジュをご利用いただけます。",
                    "remaining_free": 0,
                    "limit": daily_limit,
                }
                return Response(body, status=status.HTTP_200_OK)

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

            # --- 暫定/placeholder は空理由に置換（以降の正規化を効かせる） ---
            try:
                for r in recs.get("recommendations") or []:
                    if (r.get("reason") or "").strip().lower() in ("暫定", "placeholder"):
                        r["reason"] = ""
            except Exception:
                pass

            # --- 暫定（近隣の神社/暫定reason）のみなら DB フォールバックへ ---
            try:
                recs_list = list(data.get("recommendations") or [])
            except Exception:
                recs_list = []

            def _is_provisional(r: dict) -> bool:
                nm = (r.get("name") or "").strip()
                rs = (r.get("reason") or "").strip().lower()
                return (nm in ("近隣の神社",)) or (rs in ("暫定", "placeholder"))

            if recs_list and all(isinstance(r, dict) and _is_provisional(r) for r in recs_list):
                data = {"recommendations": []}

            # 5) LLMが空 → DBフォールバックは一旦無効化（重複除去だけ行う）
            try:
                data["recommendations"] = dedupe_recommendations(
                    data.get("recommendations") or []
                )
            except Exception:
                data["recommendations"] = data.get("recommendations") or []

            if not data["recommendations"]:
                data["recommendations"] = [
                    {
                        "id": 0,
                        "name": "おすすめの神社（ダミー）",
                        "location": None,
                        "score": 0.0,
                        "popular_score": 0.0,
                        "tags": [],
                        "deities": [],
                        "reason": "",
                        "__dummy": True,
                    }
                ]

            dummy_only = all(r.get("__dummy") for r in data.get("recommendations") or [])

            # 5.5) DBタグ & 御祭神を後付け（ダミーだけのときはスキップ）
            if not dummy_only:
                try:
                    from math import cos, radians
                    from temples.models import Shrine

                    recs_ = list(data.get("recommendations") or [])
                    lat0 = (bias or {}).get("lat")
                    lng0 = (bias or {}).get("lng")

                    by_id = {}
                    ids = [r.get("id") for r in recs_ if r.get("id")]
                    if ids:
                        qs = Shrine.objects.filter(id__in=ids).prefetch_related(
                            "goriyaku_tags", "deities"
                        )
                        by_id = {s.id: s for s in qs}

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
                                return abs(la - lat0) + abs((lo - lng0) * cos(radians(lat0)))
                            except Exception:
                                return 1e9

                        return min(found, key=approx_deg)

                    out = []
                    for r in recs_:
                        s = None
                        rid = r.get("id")
                        if rid and rid in by_id:
                            s = by_id[rid]
                        if s is None:
                            s = _nearest_by_name(r.get("name") or "")

                        if s:
                            try:
                                tag_names = [t.slug or t.name for t in s.goriyaku_tags.all()]
                            except Exception:
                                tag_names = []
                            try:
                                deity_names = [d.name for d in s.deities.all()]
                            except Exception:
                                deity_names = []

                            r["deities"] = deity_names
                            r["tags"] = sorted(
                                set((r.get("tags") or []) + tag_names + deity_names)
                            )

                        out.append(r)

                    data = {"recommendations": out}
                except Exception:
                    pass

            try:
                data["recommendations"] = dedupe_recommendations(data.get("recommendations") or [])
            except Exception:
                pass

            # 6) 運気スコア加点（任意）
            birthdate = request.data.get("birthdate")
            wish = (request.data.get("wish") or "").strip()

            if not wish:
                qtxt = request.data.get("query") or ""
                M = {
                    "縁結び": "縁結び",
                    "恋愛": "縁結び",
                    "学業": "学業成就",
                    "合格": "学業成就",
                    "金運": "金運",
                    "商売": "商売繁盛",
                }
                for k, v in M.items():
                    if k in qtxt:
                        wish = v
                        break
            if birthdate or wish:
                prof = fortune_profile(birthdate)
                ranked = list(data.get("recommendations") or [])

                for r in ranked:
                    tags = set(
                        (r.get("tags") or []) + (r.get("benefits") or []) + (r.get("deities") or [])
                    )
                    base = float(r.get("score") or 0.0)
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

            # --- (MINI WIRE) LLM で “推しポイント” を後付け（あれば） ---
            try:
                from django.conf import settings as _s

                if getattr(_s, "USE_LLM_CONCIERGE", False) and (data.get("recommendations") or []):
                    shrines_payload = []
                    for r in data["recommendations"]:
                        shrines_payload.append(
                            {
                                "tags": r.get("tags") or [],
                                "deities": r.get("deities") or [],
                                "popular_score": r.get("popular_score", 0),
                            }
                        )
                    user_ctx = {"query": query, "area": area}
                    reasons = llm.summarize(shrines_payload, user_ctx=user_ctx)

                    def _polish(rec: dict, raw: Optional[str]) -> str:
                        nm = (rec.get("name") or "").strip()
                        t = (raw or "").strip()
                        tags = set((rec.get("tags") or []) + (rec.get("deities") or []))

                        if any(x in t.lower() for x in ("no ", "n/a", "tags", "deities")):
                            t = ""
                        if t and sum(ch.isascii() for ch in t) > len(t) * 0.2:
                            t = ""
                        if t == nm or (nm and t.replace(" ", "") == nm.replace(" ", "")):
                            t = ""
                        if t in tags:
                            t = ""
                        if t and len(t) <= 6 and t in "".join(tags):
                            t = ""
                        if t and ("," in t or "、" in t) and len(t) < 40:
                            t = ""

                        STRONG_DEITIES = ("歓喜天", "観音", "観音菩薩")
                        if not t and any(any(sd in s for s in tags) for sd in STRONG_DEITIES):
                            for k, hint in TAG_DEITY_HINTS.items():
                                if any(k in s for s in tags):
                                    t = hint
                                    break

                        if not t:
                            qtxt = query or ""
                            for key, hint in WISH_HINTS:
                                if key in qtxt:
                                    t = hint
                                    break

                        if not t:
                            for k, hint in TAG_DEITY_HINTS.items():
                                if any(k in s for s in tags):
                                    t = hint
                                    break

                        if not t:
                            ps = rec.get("popular_score") or 0
                            if ps >= 7:
                                t = "定番の参拝スポットとして人気"
                            elif ps >= 4:
                                t = "地域で親しまれる参拝所"
                            else:
                                t = "静かに参拝できる穴場"

                        return t[:30] if len(t) > 30 else t

                    for rec, reason in zip(data["recommendations"], reasons, strict=False):
                        rec["reason"] = _polish(rec, reason)

                    def _wish_key_from_query(q: str) -> Optional[str]:
                        for k in ("縁結び", "学業", "金運", "厄除"):
                            if k in q:
                                return k
                        return None

                    wish_key = _wish_key_from_query(query or "")
                    seen: Dict[str, List[dict]] = {}
                    for r in data["recommendations"]:
                        t = (r.get("reason") or "").strip()
                        if t:
                            seen.setdefault(t, []).append(r)

                    for t, items in seen.items():
                        if len(items) <= 1:
                            continue
                        for idx, rec in enumerate(items[1:], start=1):
                            swapped = None
                            tags = set((rec.get("tags") or []) + (rec.get("deities") or []))
                            for k, hint in TAG_DEITY_HINTS.items():
                                if any(k in s for s in tags) and hint != t:
                                    swapped = hint
                                    break
                            if not swapped and wish_key and wish_key in WISH_SYNONYMS:
                                syns = [s for s in WISH_SYNONYMS[wish_key] if s != t]
                                if syns:
                                    swapped = syns[(idx - 1) % len(syns)]
                            if not swapped:
                                ps = rec.get("popular_score") or 0
                                if "人気" not in t and ps >= 7:
                                    swapped = "参拝者が多く評判の社"
                                elif "親しまれる" not in t and ps >= 4:
                                    swapped = "地域で親しまれる社"
                                else:
                                    swapped = "静かに手を合わせたい社"
                            rec["reason"] = swapped[:30]
            except Exception:
                pass

            try:
                for r in data.get("recommendations") or []:
                    if r.get("name"):
                        cleaned = _clean_display_name(r["name"])
                        r["display_name"] = cleaned
                        r["name"] = cleaned
                    r["reason"] = _normalize_reason(r, query=query)
            except Exception:
                pass

            recs_list = data.get("recommendations") or []
            if recs_list:
                top_names = [
                    str(r.get("name") or r.get("display_name") or r.get("id"))
                    for r in recs_list[:3]
                ]
                reply_text = "候補: " + " / ".join(top_names)
            else:
                reply_text = "候補が見つかりませんでした。"

            thread_payload = None
            if request.user.is_authenticated:
                raw_thread_id = request.data.get("thread_id") or request.data.get("threadId")

                try:
                    thread_id = int(raw_thread_id) if raw_thread_id is not None else None
                except Exception:
                    thread_id = None

                recs_list = data.get("recommendations") or []
                if recs_list:
                    top_names = [
                        str(r.get("name") or r.get("display_name") or r.get("id"))
                        for r in recs_list[:3]
                    ]
                    reply_text = "候補: " + " / ".join(top_names)
                else:
                    reply_text = "候補が見つかりませんでした。"

                try:
                    result = append_chat(
                        user=request.user,
                        query=query,
                        reply_text=reply_text,
                        thread_id=thread_id,
                    )
                    t = result.thread
                    thread_payload = {
                        "id": t.id,
                        "title": t.title,
                        "last_message": t.last_message,
                        "last_message_at": (
                            t.last_message_at.isoformat() if t.last_message_at else None
                        ),
                        "message_count": t.message_count,
                    }
                except Exception:
                    thread_payload = None

            body: dict[str, Any] = {"ok": True, "data": data, "reply": reply_text}
            if thread_payload is not None:
                body["thread"] = thread_payload

            # ★ 認証ユーザーの場合のみ1回分カウントし、残り回数を返す
            if user is not None and usage is not None:
                usage.count += 1
                usage.save(update_fields=["count"])
                after_remaining = max(daily_limit - usage.count, 0)
                body["remaining_free"] = after_remaining
                body["limit"] = daily_limit

            return Response(body, status=status.HTTP_200_OK)

        except Exception as e:
            log.exception("concierge chat failed: %s", e)
            from temples.llm.client import PLACEHOLDER

            fallback = PLACEHOLDER["content"]

            return Response(
                {
                    "ok": True,
                    "data": {"raw": fallback},
                    "reply": fallback,
                    "note": "fallback-returned",
                },
                status=status.HTTP_200_OK,
            )

                       


        



class ConciergeChatViewLegacy(ConciergeChatView):
    schema = None


class ConciergePlanView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "concierge"

    @extend_schema(
        summary="Concierge trip plan",
        description="query を元に簡易的な参拝プラン（stops 等）を返します。",
        request=ConciergePlanRequestSerializer,  # 既存の正規シリアライザを使用
        responses={200: OpenApiTypes.OBJECT},  # stops や互換 data を含む柔らかい構造
        tags=["concierge"],
    )
    def post(self, request, *args, **kwargs):  # noqa: C901
        """
        Shrine を一切参照しない軽量版。
        - query 必須
        - LLM候補（なければ暫定1件）
        - Places/内部ヘルパで location/display_address を極力補う
        - 簡易 stops を生成して返す
        """
        s = ConciergePlanRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)

        query = (s.validated_data.get("query") or "").strip()
        if not query:
            return Response(
                {"query": ["この項目は必須です。"]},
                status=status.HTTP_400_BAD_REQUEST,
            )
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

        # ==== 5km 安定化: ここで locbias を一度だけ決めて固定 ====
        locbias_fixed = request.data.get("locationbias")

        def _is_5km_flag(serializer_obj, raw_req) -> bool:
            vd = getattr(serializer_obj, "validated_data", {}) or {}
            # 1) 文字・数値のあらゆる表記を拾う
            tokens = [
                vd.get("radius_km"),
                raw_req.get("radius_km"),
                vd.get("radius"),
                raw_req.get("radius"),
                raw_req.get("radius_m"),
            ]
            for v in tokens:
                if v is None:
                    continue
                if isinstance(v, (int, float)) and abs(float(v) - 5.0) < 1e-9:
                    return True
                t = str(v).strip().lower()
                if t in {"5", "5.0", "5km", "5000", "5000m"}:
                    return True
            # 2) 最終的に m に正規化して 5000m なら 5km
            merged = {
                "radius_m": vd.get("radius_m") or raw_req.get("radius_m"),
                "radius_km": vd.get("radius_km") or raw_req.get("radius_km"),
                "radius": vd.get("radius") or raw_req.get("radius"),
            }
            return _parse_radius(merged) == 5000

        is_5km = _is_5km_flag(s, request.data)

        if not locbias_fixed:
            if is_5km:
                # ★ 常に東京駅 5km を固定
                locbias_fixed = "circle:5000@35.6812,139.7671"
            elif bias:
                try:
                    locbias_fixed = bf._lb_from_bias(bias)
                except Exception:
                    locbias_fixed = None
        # プローブ名（候補先頭 → クエリ → 既定）
        probe_name = None
        if candidates and isinstance(candidates[0], dict):
            probe_name = (candidates[0].get("name") or "").strip()
        probe_name = probe_name or (query or "神社")

        # 1) ダミー FindPlace（ログ目的）: ★ 5km 指定なら常に東京駅5kmで1発打つ
        if is_5km:
            try:
                GP.findplacefromtext(
                    input=probe_name,
                    inputtype="textquery",
                    language="ja",
                    fields="place_id",
                    locationbias="circle:5000@35.6812,139.7671",
                )
            except Exception:
                pass  # ログ用途なので失敗は無視

        # 2) 実補完 FindPlace（★ 以降は常に locbias_fixed を使う）
        locbias = locbias_fixed
        try:
            GP.findplacefromtext(
                input=probe_name,
                language=language,
                locationbias=locbias,
                fields="place_id,name,formatted_address,geometry",
            )
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

        # LLM が空なら暫定候補（理由は空→後段で正規化）
        if not (recs.get("recommendations") or []):
            if candidates:
                first_name = (
                    candidates[0].get("name") if isinstance(candidates[0], dict) else None
                ) or "近隣の神社"
                recs = {"recommendations": [{"name": first_name, "reason": ""}]}
            else:
                recs = {"recommendations": [{"name": "近隣の神社", "reason": ""}]}

        # ---- (1) area があれば先頭候補に短縮住所を display に入れ、必要なら location を文字列＋ロック ----
        lock_applied = False  # fill_locations 後の保険再適用用フラグ
        if area:
            short_area = _short_area(area)
            try:
                if recs.get("recommendations"):
                    first = recs["recommendations"][0]
                    if isinstance(first, dict):
                        # display_address は常に付与
                        first = {**first, "display_address": short_area}
                        # location が dict でなければ area を文字列で入れてロック
                        if not isinstance(first.get("location"), dict):
                            first["location"] = short_area
                            first["_lock_text_loc"] = True
                            lock_applied = True
                        recs["recommendations"][0] = first
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

        # --- (1') fill_locations 後の「area の短縮住所を保険で再適用」＋ロック維持 ---
        try:
            if area:
                try:
                    short_area = _short_area(area)
                except Exception:
                    short_area = area
                if filled.get("recommendations"):
                    first = filled["recommendations"][0]
                    if isinstance(first, dict):
                        first.setdefault("display_address", short_area)
                        # もし最初にロックを付けたなら、ここでも文字列 location を強制しロック復活
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

        # display_address / display_name 付与 & 理由の最終正規化
        try:
            for r in filled.get("recommendations") or []:
                # 推し文の最終整形（先に適用して display_name の影響を排除）
                r["reason"] = _normalize_reason(r, query=query)

                # 表示名の整形（display_name と name の両方をクリーンに）
                if r.get("name"):
                    cleaned = _clean_display_name(r["name"])
                    r["display_name"] = cleaned
                    r["name"] = cleaned

                # display_address
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

        # --- (2) 座標の最終補完：ロック尊重（文字列 location を維持） ---
        try:
            # ★ 以降は固定した locbias を一貫して使用
            locbias = locbias_fixed

            patched = []
            for r in filled.get("recommendations") or []:
                # ロックがあり location が文字列なら一切いじらない
                if r.get("_lock_text_loc") and isinstance(r.get("location"), str):
                    if area and not r.get("display_address"):
                        short_area = _short_area(area)
                        r.setdefault("display_address", short_area)
                    patched.append(r)
                    continue

                loc = r.get("location")
                # 既に lat/lng があれば何もしない
                if (
                    isinstance(loc, dict)
                    and loc.get("lat") is not None
                    and loc.get("lng") is not None
                ):
                    patched.append(r)
                    continue

                # 1) geometry が付いていれば使う
                g = (r.get("geometry") or {}).get("location") or {}
                lat = g.get("lat")
                lng = g.get("lng")
                if lat is not None and lng is not None:
                    r["location"] = {"lat": float(lat), "lng": float(lng)}
                    patched.append(r)
                    continue

                # 2) Places の FindPlace で geometry を取得（名称＋locationbias）
                try:
                    probe = (r.get("name") or "").strip()
                    if area:
                        probe = f"{probe} {area}".strip()
                    res = GP.findplacefromtext(
                        input=probe or "神社",
                        language=language,
                        locationbias=locbias,
                        fields="place_id,name,formatted_address,geometry",
                    )
                except Exception:
                    res = None

                try:
                    cand = (res.get("candidates") or [{}])[0] if isinstance(res, dict) else {}
                    g2 = (cand.get("geometry") or {}).get("location") or {}
                    lat2, lng2 = g2.get("lat"), g2.get("lng")
                    if lat2 is not None and lng2 is not None:
                        r["location"] = {"lat": float(lat2), "lng": float(lng2)}
                    # display_address が未設定なら、短縮住所を付与
                    if not r.get("display_address"):
                        addr = cand.get("formatted_address")
                        if addr:
                            try:
                                r["display_address"] = bf._shorten_japanese_address(addr) or addr
                            except Exception:
                                r["display_address"] = addr
                except Exception:
                    # 取得失敗はそのまま（display_address があれば UI で表示可能）
                    pass

                patched.append(r)

            filled = {"recommendations": patched}
        except Exception:
            pass

        # ---- 座標補完ヘルパ群（複雑度削減のため分割） -------------------------
        def _pt_from_dict(loc: Any) -> dict | None:
            if isinstance(loc, dict):
                la, ln = loc.get("lat"), loc.get("lng")
                try:
                    if la is not None and ln is not None:
                        return {"lat": float(la), "lng": float(ln)}
                except Exception:
                    return None
            return None

        def _pt_from_geometry(rec: dict) -> dict | None:
            g = (rec.get("geometry") or {}).get("location") or {}
            if "lat" in g and "lng" in g:
                try:
                    return {"lat": float(g["lat"]), "lng": float(g["lng"])}
                except Exception:
                    return None
            return None

        def _pt_from_db_name(rec: dict) -> dict | None:
            try:
                from temples.models import Shrine

                name = (rec.get("name") or "").strip()
                if not name:
                    return None
                qs = Shrine.objects.filter(name_jp__icontains=name).only("latitude", "longitude")[
                    :5
                ]
                items = list(qs)
                if not items:
                    return None
                s = items[0]
                if s.latitude is None or s.longitude is None:
                    return None
                # display_address が空なら軽量補完
                try:
                    if not rec.get("display_address"):
                        probe = f"{name} {area}".strip() if area else name
                        lb = None
                        try:
                            # ★ 先に post() 冒頭で決めた locbias を優先（5kmは東京駅5kmを固定）
                            lb = locbias or (bf._lb_from_bias(bias) if bias else None)
                        except Exception:
                            pass
                        res = GP.findplacefromtext(
                            input=probe or "神社",
                            language=language,
                            locationbias=lb,
                            fields="formatted_address",
                        )
                        addr = (res.get("candidates") or [{}])[0].get("formatted_address")
                        if addr:
                            rec["display_address"] = bf._shorten_japanese_address(addr) or addr
                        elif area:
                            rec["display_address"] = _short_area(area)
                except Exception:
                    pass
                return {"lat": float(s.latitude), "lng": float(s.longitude)}
            except Exception:
                return None

        def _pt_from_places(rec: dict) -> tuple[dict | None, None | str]:
            probe = (rec.get("name") or "").strip()
            q = f"{probe} {area}".strip() if area else probe
            # ★ 同上：計算済み locbias を最優先
            try:
                lb = locbias or (bf._lb_from_bias(bias) if bias else None)
            except Exception:
                lb = None
            try:
                res = GP.findplacefromtext(
                    input=q or "神社",
                    language=language,
                    locationbias=lb,
                    fields="place_id,name,formatted_address,geometry",
                )
                cand = (res.get("candidates") or [{}])[0] if isinstance(res, dict) else {}
                g2 = (cand.get("geometry") or {}).get("location") or {}
                la, ln = g2.get("lat"), g2.get("lng")
                pt = (
                    {"lat": float(la), "lng": float(ln)}
                    if la is not None and ln is not None
                    else None
                )
                addr = cand.get("formatted_address")
                return pt, addr
            except Exception:
                return None, None

        def _pt_from_text(loc: Any) -> dict | None:
            if isinstance(loc, str) and loc.strip():
                try:
                    pt = bf._geocode_text_center(loc.strip())
                    if pt and "lat" in pt and "lng" in pt:
                        return {"lat": float(pt["lat"]), "lng": float(pt["lng"])}
                except Exception:
                    return None
            return None

        def _pt_from_name_then_geocode(rec: dict) -> tuple[dict | None, None | str]:
            probe = (rec.get("name") or "").strip()
            try:
                # lookup 側も locbias 由来の bias を尊重（緩く）
                addr = bf._lookup_address_by_name(probe, bias=bias, lang=language)
                if not addr:
                    return None, None
                pt = bf._geocode_text_center(addr)
                if pt and "lat" in pt and "lng" in pt:
                    return {"lat": float(pt["lat"]), "lng": float(pt["lng"])}, addr
            except Exception:
                return None, None
            return None, None

        def _coerce_point(rec: dict) -> dict | None:
            """rec.location を {lat,lng} にする。取れなければ None"""
            # --- (3) ロック尊重：文字列 location を保護 ---
            if rec.get("_lock_text_loc") and isinstance(rec.get("location"), str):
                return None

            loc = rec.get("location")
            # 1) 既存の dict
            pt = _pt_from_dict(loc)
            if pt:
                return pt
            # 2) DB by name（最初に当たれば即返）
            pt = _pt_from_db_name(rec)
            if pt:
                return pt
            # 3) geometry
            pt = _pt_from_geometry(rec)
            if pt:
                return pt
            # 4) Places(name+bias)
            pt, addr = _pt_from_places(rec)
            if pt:
                if addr and not rec.get("display_address"):
                    try:
                        rec["display_address"] = bf._shorten_japanese_address(addr) or addr
                    except Exception:
                        rec["display_address"] = addr
                return pt
            # 5) location がテキストなら簡易ジオコード
            pt = _pt_from_text(loc)
            if pt:
                return pt
            # 6) “名前→住所→座標”
            pt, addr = _pt_from_name_then_geocode(rec)
            if pt:
                if addr and not rec.get("display_address"):
                    try:
                        rec["display_address"] = bf._shorten_japanese_address(addr) or addr
                    except Exception:
                        rec["display_address"] = addr
                return pt
            return None

        # 実際に正規化を適用（ロックを最初に尊重）
        try:
            patched = []
            for r in filled.get("recommendations") or []:
                if r.get("_lock_text_loc") and isinstance(r.get("location"), str):
                    patched.append(r)  # 何も変換しない
                    continue
                pt = _coerce_point(r)
                if pt is not None:
                    r["location"] = pt
                patched.append(r)
            filled = {"recommendations": patched}
        except Exception:
            pass

        # 簡易 stops 生成（徒歩3分 + 滞在30分）
        stops = []
        try:
            eta = 0
            for i, rec in enumerate((filled.get("recommendations") or [])[:6], start=1):
                name = rec.get("display_name") or _clean_display_name(
                    rec.get("name") or f"Spot {i}"
                )
                loc = rec.get("location")
                lat = loc.get("lat") if isinstance(loc, dict) else None
                lng = loc.get("lng") if isinstance(loc, dict) else None
                travel_minutes = 3
                eta += travel_minutes
                # 表示住所のフォールバック（無ければ座標を短く表示）
                disp = rec.get("display_address") or (
                    f"{lat:.3f}, {lng:.3f}" if (lat is not None and lng is not None) else None
                )
                stops.append(
                    {
                        "order": i,
                        "name": name,
                        "display_address": disp,
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


class ConciergePlanViewLegacy(ConciergePlanView):
    schema = None





# --- expose function-style views for URLConf / tests ---
chat = ConciergeChatView.as_view()
plan = ConciergePlanView.as_view()
chat_legacy = ConciergeChatViewLegacy.as_view()
plan_legacy = ConciergePlanViewLegacy.as_view()
__all__ = [
    "chat",
    "plan",
    "chat_legacy",
    "plan_legacy",
    "ConciergeChatView",
    "ConciergePlanView",
    "ConciergeChatViewLegacy",
    "ConciergePlanViewLegacy",
]
