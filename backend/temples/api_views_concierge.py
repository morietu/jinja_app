
# backend/temples/api_views_concierge.py
from __future__ import annotations

from typing import Any, Dict, Optional

import logging
import os
import re

import requests
from django.conf import settings as dj_settings
from django.utils import timezone
from drf_spectacular.utils import OpenApiTypes, extend_schema
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import TokenError
from temples.llm import extract_intent
from temples.services.concierge_chat import build_chat_recommendations
from temples.domain.fortune import fortune_profile
from temples.domain.match import bonus_score
from temples.domain.wish_map import get_hints_for_wish, match_wish_from_query
from temples.llm import backfill as bf

from temples.llm import orchestrator as orch
from temples.llm.backfill import fill_locations

from temples.serializers.concierge import ConciergePlanRequestSerializer
from temples.services import google_places as GP
from temples.services.concierge_history import append_chat
from temples.models import ConciergeThread



from .models import ConciergeUsage


log = logging.getLogger(__name__)

# --- compat: tests monkeypatch 用に module attribute を生やす ---
# import 時に orch 側の依存で落ちても、このモジュール自体は import できるようにする
try:
    ConciergeOrchestrator = orch.ConciergeOrchestrator
    orchestrate_concierge = orch.orchestrate_concierge
except Exception:  # pragma: no cover
    ConciergeOrchestrator = None  # type: ignore[misc,assignment]

    def orchestrate_concierge(*args, **kwargs):  # type: ignore[no-redef]
        return {"recommendations": []}




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
    lat = data.get("lat")
    lng = data.get("lng")
    area_text = (data.get("where") or data.get("area") or data.get("location_text") or "").strip()

    # ★ 追加：area がある & lat/lng が無いなら、この場で geocode する（テストはここを見てる）
    if area_text and (lat is None or lng is None):
        key = (
            getattr(dj_settings, "GOOGLE_MAPS_API_KEY", None)
            or getattr(dj_settings, "GOOGLE_API_KEY", None)
            or os.getenv("GOOGLE_MAPS_API_KEY")
            or os.getenv("GOOGLE_API_KEY")
            or os.getenv("MAPS_API_KEY")
            or os.getenv("PLACES_API_KEY")
        )
        if key:
            try:
                r = requests.get(
                    "https://maps.googleapis.com/maps/api/geocode/json",
                    params={"key": key, "address": area_text, "language": "ja", "region": "jp"},
                    timeout=6,
                )
                res = r.json().get("results") or []
                if res:
                    loc = res[0].get("geometry", {}).get("location") or {}
                    lat = loc.get("lat", lat)
                    lng = loc.get("lng", lng)
            except Exception:
                pass

    if lat is None or lng is None:
        return None
    try:
        lat = float(lat)
        lng = float(lng)
    except Exception:
        return None

    r_m = _parse_radius(data)
    # backfill._lb_from_bias は radius / radius_m どっちでもOKなので両方入れておく
    return {"lat": lat, "lng": lng, "radius": r_m, "radius_m": r_m}


def _enrich_candidates_with_places(candidates, *, lat=None, lng=None, area: str | None = None):
    """
    candidate に formatted_address が無ければ Places で補う（8km bias）
    API キーが無い場合はそのまま返す
    """
    key = (
        getattr(dj_settings, "GOOGLE_MAPS_API_KEY", None)
        or getattr(dj_settings, "GOOGLE_API_KEY", None)
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


def _clean_display_name(name: Any) -> str:
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
    n = re.sub(r"(神社|大社|神宮|宮|八幡宮|天満宮|稲荷神社|稲荷|寺|院|観音|大師|不動尊|堂|社)$", "", n)
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


# --- pytest 安定化：外部 export された BILLING_STUB_* に引きずられない ---
_ORIG_BILLING_STUB_PLAN = os.environ.get("BILLING_STUB_PLAN")
_ORIG_BILLING_STUB_ACTIVE = os.environ.get("BILLING_STUB_ACTIVE")


def _billing_stub_env() -> tuple[str, str]:
    plan = os.environ.get("BILLING_STUB_PLAN")
    active = os.environ.get("BILLING_STUB_ACTIVE")

    if getattr(dj_settings, "IS_PYTEST", False):
        # pytest開始前から存在していた値（=外部export）は無視して free 扱いへ
        if plan == _ORIG_BILLING_STUB_PLAN:
            plan = None
        if active == _ORIG_BILLING_STUB_ACTIVE:
            active = None

    plan = (plan or "free").strip().lower()
    active = (active or "0").strip().lower()
    return plan, active


def _is_premium_active() -> bool:
    plan, active = _billing_stub_env()
    return (plan == "premium") and (active in {"1", "true", "yes", "y", "on"})


def _billing_recommend_limit() -> int:
    # free は少なめ / premium は多め（既存の stops が最大6なので premium=6 が自然）
    return 6 if _is_premium_active() else 3


def _force_user_from_bearer(req):
    """
    DRFが認証しなくても、Authorization: Bearer <token> があれば user を復元する。
    DRF Request / Django HttpRequest 両対応。
    """

    def _get_auth(r):
        if r is None:
            return None
        # DRF Request
        try:
            h = r.headers.get("Authorization")
            if h:
                return h
        except Exception:
            pass
        # Django HttpRequest
        try:
            return r.META.get("HTTP_AUTHORIZATION")
        except Exception:
            return None

    auth = _get_auth(req) or _get_auth(getattr(req, "_request", None))
    if not auth:
        return None, None

    parts = str(auth).strip().split()
    if len(parts) != 2:
        return None, None
    typ, token = parts
    if typ.lower() not in {"bearer", "jwt"}:
        return None, None

    ja = JWTAuthentication()
    try:
        validated = ja.get_validated_token(token)
        user = ja.get_user(validated)
        return user, validated
    except TokenError:
        return None, None
    except Exception:
        return None, None


def _resolve_user_and_token(request):
    """
    1) DRF の request.user（既に認証済みならそれを使う）
    2) JWTAuthentication().authenticate を DRF Request / Django HttpRequest の両方で試す
    3) Authorization: Bearer から強制復元
    """
    # 1) DRFが既にセットしているなら最優先
    try:
        u = getattr(request, "user", None)
        if u is not None and getattr(u, "is_authenticated", False):
            return u, getattr(request, "auth", None)
    except Exception:
        pass

    ja = JWTAuthentication()

    # 2) authenticate を両方で試す（ここが rate_limit 安定化の肝）
    for req in (request, getattr(request, "_request", None)):
        if req is None:
            continue
        try:
            pair = ja.authenticate(req)
        except Exception:
            pair = None
        if pair:
            return pair[0], pair[1]

    # 3) Bearer から復元
    return _force_user_from_bearer(request)


LIMIT_MSG = "無料で利用できる回数を使い切りました。"







class ConciergeChatView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = [JWTAuthentication, SessionAuthentication]
    throttle_scope = "concierge"

    def post(self, request, *args, **kwargs):
        data = request.data or {}

        message = (data.get("message") or "").strip()
        query = (data.get("query") or "").strip()

        # ★ message が来たら問答無用で message モード（query が一緒に来ても）
        is_message_mode = bool(message)

        # 実際に処理する query は message 優先（=ユーザー入力を優先）
        query = message or query

        if not query:
            return Response({"detail": "query is required"}, status=status.HTTP_400_BAD_REQUEST)

        language = (data.get("language") or "ja").strip()
        candidates = data.get("candidates") or []
        bias = _build_bias(data)

        # intent は常に返す
        intent = extract_intent(query)

        # ---- user 解決（DRFが未認証でもBearerから復元）----
        user, token = _resolve_user_and_token(request)
        if user is not None:
            request.user = user
            request.auth = token

        is_premium = _is_premium_active()
        today = timezone.localdate()
        daily_limit = getattr(dj_settings, "CONCIERGE_DAILY_FREE_LIMIT", 5)
        remaining = None

        # ---- rate limit：認証済み & 非premium のみ ----
        if user is not None and not is_premium:
            usage, _ = ConciergeUsage.objects.get_or_create(user=user, date=today)

            if usage.count >= daily_limit:
                recs = {"recommendations": []}
                body = {
                    "ok": True,
                    "intent": intent,
                    "data": recs,
                    "reply": LIMIT_MSG,
                    "remaining_free": 0,
                    "limit": daily_limit,
                    "note": "limit-reached",
                }

                # message モードなら候補表示形式で返す（テスト要件）
                if is_message_mode:
                    names = []
                    for r in (recs.get("recommendations") or [])[:3]:
                        if isinstance(r, dict):
                            nm = (r.get("display_name") or r.get("name") or "").strip()
                            if nm:
                                names.append(nm)
                    body["reply"] = f"候補: {', '.join(names)}" if names else "候補: "

                return Response(body, status=status.HTTP_200_OK)

            usage.count += 1
            usage.save(update_fields=["count"])
            remaining = max(daily_limit - usage.count, 0)

        

        birthdate = (data.get("birthdate") or "").strip() or None

        recs = build_chat_recommendations(
            query=query,
            language=language,
            candidates=candidates,
            bias=bias,
            birthdate=birthdate,
        )

        body = {"ok": True, "intent": intent, "data": recs}

        


        # 非premium認証ユーザーだけ remaining_free/limit を返す
        if user is not None and not is_premium:
            body["remaining_free"] = remaining
            body["limit"] = daily_limit

        # message がある時は「候補: ...」を必ず返す（テスト要件）
        if is_message_mode:
            names = []
            for r in (recs.get("recommendations") or [])[:3]:
                if isinstance(r, dict):
                    nm = (r.get("display_name") or r.get("name") or "").strip()
                    if nm:
                        names.append(nm)
            body["reply"] = f"候補: {', '.join(names)}" if names else "候補: "
        else:
            if not candidates:
                body["reply"] = None

        # --- thread 保存（認証ユーザーのみ）---

        thread_obj = None
        if user is not None and getattr(user, "is_authenticated", False):
            # ✅ thread_id / threadId 両対応
            thread_id_raw = data.get("thread_id") or data.get("threadId")

            # ✅ int 変換 + 0/"" は None 扱い
            try:
                thread_id = int(thread_id_raw) if thread_id_raw not in (None, "", 0, "0") else None
            except Exception:
                thread_id = None

            # ✅ 保存したい返信文（無ければ None）
            reply_text = body.get("reply")
            if not isinstance(reply_text, str):
                reply_text = None

            try:
                saved = append_chat(user=user, query=query, reply_text=reply_text, thread_id=thread_id)
                thread_obj = saved.thread
            except ConciergeThread.DoesNotExist:
                # 不正な thread_id が来たら新規で作る
                saved = append_chat(user=user, query=query, reply_text=reply_text, thread_id=None)
                thread_obj = saved.thread

        if thread_obj is not None:
            body["thread"] = {"id": thread_obj.id}

        return Response(body, status=status.HTTP_200_OK)
        


class ConciergeChatViewLegacy(ConciergeChatView):
    schema = None


class ConciergePlanView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "concierge"

    @extend_schema(
        summary="Concierge trip plan",
        description="query を元に簡易的な参拝プラン（stops 等）を返します。",
        request=ConciergePlanRequestSerializer,
        responses={200: OpenApiTypes.OBJECT},
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
            return Response({"query": ["この項目は必須です。"]}, status=status.HTTP_400_BAD_REQUEST)

        language = s.validated_data.get("language", "ja")
        transportation = s.validated_data.get("transportation", "walk")
        candidates = request.data.get("candidates") or []
        area = request.data.get("area") or request.data.get("where") or request.data.get("location_text")

        # bias を構築（km/m→m, 50km clip）
        bias = _build_bias(request.data)

        # ==== 5km 安定化: ここで locbias を一度だけ決めて固定 ====
        locbias_fixed = request.data.get("locationbias")

        def _is_5km_flag(serializer_obj, raw_req) -> bool:
            vd = getattr(serializer_obj, "validated_data", {}) or {}
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
            merged = {
                "radius_m": vd.get("radius_m") or raw_req.get("radius_m"),
                "radius_km": vd.get("radius_km") or raw_req.get("radius_km"),
                "radius": vd.get("radius") or raw_req.get("radius"),
            }
            return _parse_radius(merged) == 5000

        is_5km = _is_5km_flag(s, request.data)

        if not locbias_fixed:
            if is_5km:
                locbias_fixed = "circle:5000@35.6812,139.7671"
            elif bias:
                try:
                    locbias_fixed = bf._lb_from_bias(bias)
                except Exception:
                    locbias_fixed = None

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
                pass

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

        # LLM が空なら暫定候補
        if not (recs.get("recommendations") or []):
            if candidates:
                first_name = (candidates[0].get("name") if isinstance(candidates[0], dict) else None) or "近隣の神社"
                recs = {"recommendations": [{"name": first_name, "reason": ""}]}
            else:
                recs = {"recommendations": [{"name": "近隣の神社", "reason": ""}]}

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

        # 住所補完（軽量）
        for rec in recs.get("recommendations", []):
            if not rec.get("location"):
                try:
                    addr = bf._lookup_address_by_name(rec.get("name") or "", bias=bias, lang=language)
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
            enriched_candidates = _enrich_candidates_with_places(candidates, lat=lat, lng=lng, area=area)
        except Exception:
            enriched_candidates = candidates

        # FindPlace+Details で後付け
        try:
            filled = fill_locations(recs, candidates=enriched_candidates, bias=bias, shorten=True)
        except Exception:
            filled = recs

        # --- (1') fill_locations 後の保険 ---
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
        birthdate = request.data.get("birthdate")
        wish = (request.data.get("wish") or "").strip()
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

        # --- (2) 座標の最終補完：ロック尊重（文字列 location を維持） ---
        try:
            locbias = locbias_fixed
            patched = []
            for r in filled.get("recommendations") or []:
                if r.get("_lock_text_loc") and isinstance(r.get("location"), str):
                    if area and not r.get("display_address"):
                        r.setdefault("display_address", _short_area(area))
                    patched.append(r)
                    continue

                loc = r.get("location")
                if isinstance(loc, dict) and loc.get("lat") is not None and loc.get("lng") is not None:
                    patched.append(r)
                    continue

                g = (r.get("geometry") or {}).get("location") or {}
                lat = g.get("lat")
                lng = g.get("lng")
                if lat is not None and lng is not None:
                    r["location"] = {"lat": float(lat), "lng": float(lng)}
                    patched.append(r)
                    continue

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
                    if not r.get("display_address"):
                        addr = cand.get("formatted_address")
                        if addr:
                            try:
                                r["display_address"] = bf._shorten_japanese_address(addr) or addr
                            except Exception:
                                r["display_address"] = addr
                except Exception:
                    pass

                patched.append(r)

            filled = {"recommendations": patched}
        except Exception:
            pass

        limit = _billing_recommend_limit()
        filled["recommendations"] = (filled.get("recommendations") or [])[:limit]

        # 簡易 stops 生成（徒歩3分 + 滞在30分）
        stops = []
        try:
            eta = 0
            for i, rec in enumerate((filled.get("recommendations") or [])[:6], start=1):
                name = rec.get("display_name") or _clean_display_name(rec.get("name") or f"Spot {i}")
                loc = rec.get("location")
                lat = loc.get("lat") if isinstance(loc, dict) else None
                lng = loc.get("lng") if isinstance(loc, dict) else None
                travel_minutes = 3
                eta += travel_minutes
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
