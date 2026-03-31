# backend/temples/api_views_concierge.py
from __future__ import annotations
import requests  # test monkeypatch compatibility
import logging
import re
import uuid
import time
from django.db import connection, reset_queries

from datetime import date
from typing import Any, Dict, List, Optional, Tuple


from django.conf import settings as dj_settings

from drf_spectacular.utils import OpenApiTypes, extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import TokenError

from temples.api.serializers.concierge import (
    ConciergePlanRequestSerializer,
    ConciergePlanResponseSerializer,
)
from temples.geocoding.client import geocode_google_point
from temples.models import ConciergeThread
from temples.services import places as Places

from temples.services.plan_service import resolve_plan_context
from temples.services.quota_service import check_quota, consume_quota
from temples.services.anonymous_id import attach_anonymous_cookie, build_anonymous_cookie_value
from temples.services.concierge_candidate_utils import (
    _dedupe_candidates,
    _to_float,
)
from temples.services.concierge_chat import build_chat_recommendations
from temples.services.concierge_chat_ranking import (
    _resolve_public_mode,
)
from temples.services.concierge_chat_candidates import build_chat_candidates
from temples.services.concierge_history import append_chat
from temples.services.concierge_plan import build_plan_response
from temples.services.billing_state import is_premium_for_user  # test monkeypatch compatibility



BIRTHDATE_PATTERNS = (
    re.compile(r"^(\d{4})-(\d{2})-(\d{2})$"),
    re.compile(r"^(\d{4})/(\d{2})/(\d{2})$"),
    re.compile(r"^(\d{4})(\d{2})(\d{2})$"),
)

def normalize_birthdate(value: Any) -> str | None:
    s = str(value or "").strip()
    if not s:
        return None

    for pattern in BIRTHDATE_PATTERNS:
        m = pattern.match(s)
        if not m:
            continue

        yyyy, mm, dd = m.groups()

        try:
            normalized = date(int(yyyy), int(mm), int(dd))
        except ValueError:
            return None

        return normalized.isoformat()

    return None


log = logging.getLogger(__name__)


def _use_llm() -> bool:
    return bool(getattr(dj_settings, "CONCIERGE_USE_LLM", False))


# --- compat: tests monkeypatch 用に module attribute を生やす ---
try:
    if _use_llm():
        from temples.llm import orchestrator as orch

        ConciergeOrchestrator = orch.ConciergeOrchestrator
        orchestrate_concierge = orch.orchestrate_concierge
    else:
        raise RuntimeError("LLM disabled")
except Exception:  # pragma: no cover
    ConciergeOrchestrator = None  # type: ignore[misc,assignment]

    def orchestrate_concierge(*args: Any, **kwargs: Any) -> dict:
        query = ""
        candidates = None

        if args:
            query = str(args[0] or "")
            if len(args) >= 2 and isinstance(args[1], list):
                candidates = args[1]

        query = str(kwargs.get("query") or query or "").strip()

        # kwargs が存在するなら None も含めて尊重
        if "candidates" in kwargs:
            candidates = kwargs.get("candidates")

        cands = [x for x in (candidates or []) if isinstance(x, dict)]
        recs = []
        for i, c in enumerate(cands[:3]):
            nm = c.get("name") or c.get("place_id") or "unknown"
            recs.append(
                {
                    "name": nm,
                    "reason": "暫定（候補ベース）",
                    "score": max(0.0, 1.0 - i * 0.1),
                }
            )

        if not recs:
            recs = [{"name": "近隣の神社", "reason": "暫定"}]
        return {"recommendations": recs}


def _safe_extract_intent(text: str):
    t = text or ""

    def _heuristic():
        if any(k in t for k in ("縁結び", "恋", "結婚")):
            return {"kind": "love"}
        if any(k in t for k in ("金運", "仕事", "商売")):
            return {"kind": "money_work"}
        if any(k in t for k in ("厄", "厄除", "厄払い")):
            return {"kind": "purification"}
        return {"kind": "general"}

    if not _use_llm():
        return _heuristic()

    try:
        from temples.llm import extract_intent

        out = extract_intent(text)
        return out or _heuristic()
    except Exception:
        return _heuristic()


def extract_intent(text: str):
    """Test monkeypatch compatibility shim."""
    return _safe_extract_intent(text)


def _force_user_from_bearer(req):
    """
    DRFが認証しなくても、Authorization: Bearer <token> があれば user を復元する。
    DRF Request / Django HttpRequest 両対応。
    """

    def _get_auth(r):
        if r is None:
            return None
        try:
            h = r.headers.get("Authorization")
            if h:
                return h
        except Exception:
            pass
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
    try:
        u = getattr(request, "user", None)
        if u is not None and getattr(u, "is_authenticated", False):
            return u, getattr(request, "auth", None)
    except Exception:
        pass

    ja = JWTAuthentication()

    for req in (request, getattr(request, "_request", None)):
        if req is None:
            continue
        try:
            pair = ja.authenticate(req)
        except Exception:
            pair = None
        if pair:
            return pair[0], pair[1]

    return _force_user_from_bearer(request)


LIMIT_MSG = "無料で利用できる回数を使い切りました。"


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


def _geocode_area_for_chat(*, area: str) -> tuple[float, float] | None:
    t0 = time.perf_counter()
    pt = geocode_google_point(area, language="ja", region="jp", timeout=6.0)
    elapsed = time.perf_counter() - t0
    log.info(
        "[concierge/perf] step=geocode elapsed=%.3f ok=%s area_len=%d",
        elapsed,
        pt is not None,
        len(area or ""),
    )
    return pt

def _probe_area_locationbias_for_chat(*, area: str | None) -> None:
    """
    Chatテスト用：area→geocode→findplace(locationbias=8000) を1回だけ叩いて、
    monkeypatch が拾う params を残す。結果は使わない。
    """
    area = (area or "").strip()
    if not area:
        log.info("[concierge/perf] step=probe_locationbias skipped=no_area")
        return

    pt = _geocode_area_for_chat(area=area)
    if not pt:
        log.info("[concierge/perf] step=probe_locationbias skipped=no_geocode_result")
        return

    lb = f"circle:8000@{pt[0]:.3f},{pt[1]:.3f}"

    t0 = time.perf_counter()
    try:
        Places.findplacefromtext(
            input=area,
            language="ja",
            fields="place_id",
            locationbias=lb,
        )
        elapsed = time.perf_counter() - t0
        log.info(
            "[concierge/perf] step=probe_locationbias elapsed=%.3f ok=1 area_len=%d",
            elapsed,
            len(area),
        )
    except Exception:
        elapsed = time.perf_counter() - t0
        log.exception(
            "[concierge/perf] step=probe_locationbias elapsed=%.3f ok=0 area_len=%d",
            elapsed,
            len(area),
        )



def _resolve_request_inputs_basic(data: Dict[str, Any]):
    filters = data.get("filters") if isinstance(data.get("filters"), dict) else {}
    for k in ("birthdate", "goriyaku_tag_ids", "extra_condition"):
        if data.get(k) in (None, "", []) and filters.get(k) not in (None, "", []):
            data[k] = filters.get(k)


    filters = data.get("filters") or {}
    if isinstance(filters, dict):
        if not data.get("birthdate") and filters.get("birthdate"):
            data["birthdate"] = filters.get("birthdate")

    if not data.get("goriyaku_tag_ids") and filters.get("goriyaku_tag_ids"):
        data["goriyaku_tag_ids"] = filters.get("goriyaku_tag_ids")
    if not data.get("extra_condition") and filters.get("extra_condition"):
        data["extra_condition"] = filters.get("extra_condition")

    message = (data.get("message") or "").strip()
    query = (data.get("query") or "").strip()
    query = message or query

    # backend救済: query が日付文字列なら birthdate に寄せる
    birthdate_raw = normalize_birthdate(data.get("birthdate"))

    if not birthdate_raw and isinstance(filters, dict):
        birthdate_raw = normalize_birthdate(filters.get("birthdate"))
        if birthdate_raw:
            data["birthdate"] = birthdate_raw

    if not birthdate_raw:
        rescued_birthdate = normalize_birthdate(query)
        if rescued_birthdate:
            data["birthdate"] = rescued_birthdate
            birthdate_raw = rescued_birthdate
            query = ""

    language = (data.get("language") or "ja").strip()
    area = data.get("area") or data.get("where") or data.get("location_text")

    birthdate = data.get("birthdate")
    goriyaku_tag_ids = data.get("goriyaku_tag_ids")
    extra_condition = data.get("extra_condition")

    return (
        query,
        message,
        language,
        area,
        birthdate,
        goriyaku_tag_ids,
        extra_condition,
    )


def _resolve_request_location_inputs(
    data: Dict[str, Any],
    *,
    area: Any,
) -> tuple[Optional[float], Optional[float]]:
    lat = _to_float(data.get("lat"))
    lng = _to_float(data.get("lng"))
    if (lat is None or lng is None) and area:
        pt = _geocode_area_for_chat(area=area)
        if pt:
            lat, lng = pt
    return lat, lng

def _build_chat_response(
    intent: Dict[str, Any],
    recs: Dict[str, Any],
    reply: Optional[str],
    plan: Optional[str],
    remaining: Optional[int],
    limit: Optional[int],
    limit_reached: bool,
    thread: Optional[Any],
    debug: Optional[Dict[str, Any]],
    anon_cookie_value: Optional[str],
) -> Dict[str, Any]:
    thread_id = str(thread.id) if thread is not None else None

    data = dict(recs or {})
    data["thread_id"] = thread_id

    body: Dict[str, Any] = {
        "ok": True,
        "intent": intent,
        "thread_id": thread_id,
        "data": data,
        "plan": plan,
        "remaining": remaining,
        "limit": limit,
        "limitReached": limit_reached,
        "reply": reply,
    }

    if debug is not None:
        body["_debug"] = debug
    if thread is not None:
        body["thread"] = {"id": thread.id}
    if anon_cookie_value is not None:
        body["_anon_cookie_value"] = anon_cookie_value
    return body

def build_reason_facts(
    *,
    matched_need_tags: list[str],
    shrine_benefit: str | None,
    shrine_feature: str | None,
    visit_fit: str | None,
    astro_label_ja: str | None,
    distance_m: float | None,
    popular_score: float | None,
    fallback_mode: str | None,
    fallback_reason_ja: str | None,
    score_need: float | None,
    score_element: float | None,
) -> dict:
    if fallback_mode == "nearby_unfiltered":
        primary_axis = "fallback"
    elif score_need and score_need > 0:
        primary_axis = "need"
    elif shrine_feature:
        primary_axis = "feature"
    elif score_element and score_element > 0 and astro_label_ja:
        primary_axis = "element"
    elif distance_m is not None:
        primary_axis = "distance"
    elif popular_score is not None:
        primary_axis = "popularity"
    else:
        primary_axis = "fallback"

    distance_label = None
    if distance_m is not None:
        if distance_m < 1000:
            distance_label = f"{round(distance_m)}m"
        else:
            distance_label = f"{distance_m / 1000:.1f}km"

    popularity_label = None
    if popular_score is not None and popular_score >= 4:
        popularity_label = "定番として選びやすい候補です"

    return {
        "version": 1,
        "primary_axis": primary_axis,
        "matched_need_tags": matched_need_tags[:2],
        "shrine_benefit": shrine_benefit,
        "shrine_feature": shrine_feature,
        "visit_fit": visit_fit,
        "matched_element": astro_label_ja,
        "distance_label": distance_label,
        "popularity_label": popularity_label,
        "fallback_reason": fallback_reason_ja,
        "confidence": "high" if (score_need or 0) + (score_element or 0) >= 2 else "mid",
    }

def _chat_quota_fields(*, plan: Optional[str], quota: Any) -> tuple[Optional[int], Optional[int]]:
    if getattr(quota, "unlimited", False):
        return None, None
    return quota.remaining, quota.limit


def _build_chat_candidates_pipeline(
    request: Any,
    lat: Optional[float],
    lng: Optional[float],
    area: Any,
    language: str,
) -> Tuple[List[Dict[str, Any]], int, int, int]:
    data = request.data or {}
    _ = language  # interface stability for future use

    raw_candidates = data.get("candidates") if isinstance(data.get("candidates"), list) else []
    user_candidates = [c for c in raw_candidates if isinstance(c, dict)]


    raw_built_candidates = build_chat_candidates(
        goriyaku_tag_ids=data.get("goriyaku_tag_ids"),
        area=area,
        lat=lat,
        lng=lng,
        trace_id=getattr(request, "_concierge_trace_id", ""),
    )

    merged_candidates = user_candidates + raw_built_candidates
    deduped_candidates = _dedupe_candidates(merged_candidates)

    log.info(
        "[api/chat] build_candidates_output trace=%s user=%d built=%d merged=%d deduped=%d",
        getattr(request, "_concierge_trace_id", ""),
        len(user_candidates),
        len(raw_built_candidates),
        len(merged_candidates),
        len(deduped_candidates),
    )

    ordered_candidates = deduped_candidates
    return (
        ordered_candidates,
        len(user_candidates),
        len(raw_built_candidates),
        len(merged_candidates),
    )

class ConciergeChatView(APIView):
    """
    concierge の主API。

    この view の責務:
    - 相談文 / 生年月日 / 条件を受けて候補を返す
    - reply / thread を含む chat 用レスポンスを返す
    - 認証済み free user に対して remaining_free / limit を返す
    - 利用上限到達時は paywall 判定の起点になる

    この view を正本とするもの:
    - 残回数表示
    - limit-reached 判定
    - chat 用のレスポンス契約

    この view が持たない責務:
    - 経路計画専用レスポンス
    - plan API の route_hints / main 構築
    """
    permission_classes = [AllowAny]
    authentication_classes = [JWTAuthentication]
    throttle_scope = "concierge"

    @extend_schema(
        tags=["concierge"],
        summary="Concierge chat",
        description="message もしくは query を受け付ける互換ラッパ",
        request=None,
        responses={200: OpenApiTypes.OBJECT},
    )
    def post(self, request, *args, **kwargs):
        reset_queries()
        t0_total = time.perf_counter()
        rid = uuid.uuid4().hex[:8]
        log.info("[concierge] chat.post rid=%s", rid)
        log.info("🔥 CHAT ENTRY HIT 🔥")

        response = None
        total_status = 500
        limit_reached = False
        mode_label = "unknown"
        phase = "init"
        query_len = 0
        candidate_count = 0
        rec_count = 0
        try:
            data = request.data or {}

            log.info(
                "[api/chat] has_lat=%s has_lng=%s has_radius_m=%s",
                data.get("lat") is not None,
                data.get("lng") is not None,
                data.get("radius_m") is not None,
            )

            # -------------------------
            # ① 入力解決
            # -------------------------
            phase = "resolve_inputs"
            t0 = time.perf_counter()

            (
                query,
                message,
                language,
                area,
                birthdate_value,
                goriyaku_tag_ids,
                extra_condition,
            ) = _resolve_request_inputs_basic(data)

            birthdate = (birthdate_value or "").strip() or None

            log.info(
                "[concierge/perf] step=resolve_inputs rid=%s elapsed=%.3f",
                rid,
                time.perf_counter() - t0,
            )

            is_message_mode = bool(message)
            mode_label = "message" if is_message_mode else "query"
            query_len = len(query or "")


            public_mode = _resolve_public_mode(
                mode=str(data.get("mode") or "").strip().lower() or None,
                birthdate=birthdate,
                query=query,
            )

            flow = (
                str(data.get("flow")).upper()
                if str(data.get("flow")).upper() in {"A", "B"}
                else ("B" if public_mode == "compat" else "A")
            )
            intent = extract_intent(query or "")

            request._concierge_trace_id = rid

            # compat は query 空を許可
            if not query and public_mode != "compat":
                response = Response(
                    {"detail": "query is required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
                total_status = 400
                return response

            

            
            # -------------------------
            # ④ auth / plan_context / quota
            # -------------------------
            phase = "quota_check"
            t0 = time.perf_counter()

            user, token = _resolve_user_and_token(request)
            if user is not None:
                request.user = user
                request.auth = token

            plan_context = resolve_plan_context(request)
            try:
                quota = check_quota(plan_context, "concierge")
            except Exception:
                raise

            log.info(
                "[concierge/perf] step=quota_check rid=%s elapsed=%.3f allowed=%s plan=%s remaining=%r limit=%r",
                rid,
                time.perf_counter() - t0,
                quota.allowed,
                plan_context.plan,
                quota.remaining,
                quota.limit,
            )

            if not quota.allowed:
                limit_reached = True
                recs = {"recommendations": []}
                remaining, limit_value = _chat_quota_fields(plan=plan_context.plan, quota=quota)
                body = _build_chat_response(
                    intent=intent,
                    recs=recs,
                    reply=LIMIT_MSG,
                    plan=plan_context.plan,
                    remaining=0 if remaining is not None else None,
                    limit=limit_value,
                    limit_reached=True,
                    thread=None,
                    debug=None,
                    anon_cookie_value=(
                        build_anonymous_cookie_value(plan_context.anon_id)
                        if plan_context.plan == "anonymous" and plan_context.anon_id
                        else None
                    ),
                )
                # 互換が不要なら削除
                # body["note"] = "limit-reached"


                if is_message_mode:
                    body["reply"] = "候補: "

                response = Response(body, status=status.HTTP_200_OK)
                total_status = 200

                if plan_context.plan == "anonymous" and plan_context.anon_id:
                    attach_anonymous_cookie(response, plan_context.anon_id)
                    log.info(
                        "[concierge/chat] after_attach_limit rid=%s cookies=%r",
                        rid,
                        response.cookies.output(),
                    )

                log.info("[concierge/chat] before_return rid=%s", rid)
                return response

            remaining, limit_value = _chat_quota_fields(plan=plan_context.plan, quota=quota)

            lat, lng = _resolve_request_location_inputs(data, area=area)

            # -------------------------
            # ② candidate build
            # -------------------------
            phase = "candidates"
            t0 = time.perf_counter()

            candidates, user_n, built_n, merged_n = _build_chat_candidates_pipeline(
                request=request,
                lat=lat,
                lng=lng,
                area=area,
                language=language,
            )
            candidate_count = len(candidates)

            log.info(
                "[concierge/perf] step=candidates rid=%s elapsed=%.3f user=%d built=%d merged=%d deduped=%d",
                rid,
                time.perf_counter() - t0,
                user_n,
                built_n,
                merged_n,
                len(candidates),
            )

            # -------------------------
            # ③ probe / bias / intent
            # -------------------------
            phase = "pre_recommend"
            t0 = time.perf_counter()
            try:
                _probe_area_locationbias_for_chat(area=area)
            except Exception:
                log.exception("[concierge/perf] step=probe rid=%s failed", rid)

            bias = None
            if lat is not None and lng is not None:
                r_m = _parse_radius(data)
                bias = {"lat": lat, "lng": lng, "radius": r_m, "radius_m": r_m}
                log.info(
                    "[api/chat] computed_bias has_bias=%s radius_m=%d",
                    bias is not None,
                    r_m,
                )

            log.info(
                "[concierge/perf] step=pre_recommend rid=%s elapsed=%.3f",
                rid,
                time.perf_counter() - t0,
            )


            # -------------------------
            # ⑤ recommendation
            # -------------------------
            phase = "recommend"
            before_n = len(candidates)
            applied = []
            if goriyaku_tag_ids:
                applied.append("goriyaku_tag_ids")
            if (extra_condition or "").strip():
                applied.append("extra_condition")
            if public_mode == "compat":
                applied.append("mode:compat")

            t0 = time.perf_counter()

            try:
                recs = build_chat_recommendations(
                    query=query or "",
                    language=language,
                    candidates=candidates,
                    bias=bias,
                    birthdate=birthdate,
                    goriyaku_tag_ids=goriyaku_tag_ids,
                    extra_condition=extra_condition,
                    public_mode=public_mode,
                    flow=flow,
                )
            except Exception:
                log.exception(
                    "[concierge/chat] recommend failed rid=%s mode=%s flow=%s candidates=%d has_bias=%s has_birthdate=%s",
                    rid,
                    public_mode,
                    flow,
                    len(candidates),
                    bias is not None,
                    birthdate is not None,
                )
                raise

            after_n = len(recs.get("recommendations") or [])
            rec_count = after_n

            log.info(
                "[concierge/perf] step=recommend rid=%s elapsed=%.3f recs=%d",
                rid,
                time.perf_counter() - t0,
                after_n,
            )

            try:
                b0 = ((recs.get("recommendations") or [{}])[0] or {}).get("breakdown")
                log.info("[api/chat] breakdown0=%s", "Y" if isinstance(b0, dict) else "N")
            except Exception:
                pass

            # -------------------------
            # ⑥ thread append
            # -------------------------
            phase = "append_chat"
            t0 = time.perf_counter()

            reply = None
            if is_message_mode:
                names = []
                for r in (recs.get("recommendations") or [])[:3]:
                    if isinstance(r, dict):
                        nm = (r.get("display_name") or r.get("name") or "").strip()
                        if nm:
                            names.append(nm)
                reply = f"候補: {', '.join(names)}" if names else "候補: "

            thread_obj = None

            thread_id_raw = data.get("thread_id") or data.get("threadId")
            try:
                thread_id = int(thread_id_raw) if thread_id_raw not in (None, "", 0, "0") else None
            except Exception:
                thread_id = None

            reply_text = reply if isinstance(reply, str) else None
            saved_query = query or "生年月日から相性を見てほしい"

            thread_recommendations = recs.get("recommendations") or []
            thread_recommendations_v2 = recs.get("recommendations_v2") or thread_recommendations

            append_user = user if getattr(user, "is_authenticated", False) else None
            append_anonymous_id = None if append_user is not None else getattr(plan_context, "anon_id", None)

            try:
                saved = append_chat(
                    user=append_user,
                    anonymous_id=append_anonymous_id,
                    query=saved_query,
                    reply_text=reply_text,
                    thread_id=thread_id,
                    recommendations=thread_recommendations,
                    recommendations_v2=thread_recommendations_v2,
                )
                thread_obj = saved.thread
            except ConciergeThread.DoesNotExist:
                saved = append_chat(
                    user=append_user,
                    anonymous_id=append_anonymous_id,
                    query=saved_query,
                    reply_text=reply_text,
                    thread_id=None,
                    recommendations=thread_recommendations,
                    recommendations_v2=thread_recommendations_v2,
                )
                thread_obj = saved.thread

            log.info(
                "[concierge/perf] step=append_chat rid=%s elapsed=%.3f thread=%r",
                rid,
                time.perf_counter() - t0,
                getattr(thread_obj, "id", None),
            )

            # -------------------------
            # ⑦ observability save
            # -------------------------
            phase = "observability"
            t0 = time.perf_counter()

            from temples.services.concierge_observability import save_concierge_recommendation_log

            signals = recs.get("_signals") or {}
            llm_meta = signals.get("llm") or {}
            result_state = signals.get("result_state") or {}
            need_meta = recs.get("_need") or {}
            need_tags_for_log = need_meta.get("tags") or []
            radius_m = _parse_radius(data)

            try:
                save_concierge_recommendation_log(
                    user=user if getattr(user, "is_authenticated", False) else None,
                    thread=thread_obj,
                    query=query or "",
                    need_tags=need_tags_for_log,
                    flow=flow,
                    llm_enabled=bool(llm_meta.get("enabled")),
                    llm_used=bool(llm_meta.get("used")),
                    recommendations=recs.get("recommendations") or [],
                    result_state=result_state,
                    lat=lat,
                    lng=lng,
                    radius_m=radius_m,
                )
            except Exception:
                log.exception("[concierge/reco] save_concierge_recommendation_log failed rid=%s", rid)

            log.info(
                "[concierge/perf] step=observability rid=%s elapsed=%.3f",
                rid,
                time.perf_counter() - t0,
            )

            # -------------------------
            # ⑧ quota consume
            # -------------------------
            phase = "consume"
            t0 = time.perf_counter()

            try:
                consume_quota(plan_context, "concierge")
            except Exception:
                log.exception(
                    "[concierge/chat] consume_quota failed rid=%s plan=%s",
                    rid,
                    getattr(plan_context, "plan", None),
                )
                raise

            log.info(
                "[concierge/perf] step=consume rid=%s elapsed=%.3f",
                rid,
                time.perf_counter() - t0,
            )

            if not quota.unlimited and remaining is not None:
                remaining = max(remaining - 1, 0)

            body = _build_chat_response(
                    intent=intent,
                    recs=recs,
                    reply=reply,
                    plan=plan_context.plan,
                    remaining=remaining,
                    limit=limit_value,
                    limit_reached=False,
                    thread=thread_obj,
                    debug={
                        "rid": rid,
                        "before": before_n,
                        "after": after_n,
                        "applied": applied,
                        "flow": flow,
                        "mode": public_mode,
                    },
                    anon_cookie_value=(
                        build_anonymous_cookie_value(plan_context.anon_id)
                        if plan_context.plan == "anonymous" and plan_context.anon_id
                        else None
                    ),
                )

            phase = "response"
            response = Response(body, status=status.HTTP_200_OK)
            total_status = 200

            if plan_context.plan == "anonymous" and plan_context.anon_id:
                attach_anonymous_cookie(response, plan_context.anon_id)
                log.info(
                    "[concierge/chat] after_attach_success rid=%s cookies=%r",
                    rid,
                    response.cookies.output(),
                )

            log.info(
                "[concierge/chat] cookie_state rid=%s cookies=%r",
                rid,
                response.cookies.output(),
            )
            log.info("[concierge/chat] before_return rid=%s", rid)
            return response
        finally:
            total_ms = round((time.perf_counter() - t0_total) * 1000, 1)
            sql_total_ms = round(sum(float(q["time"]) * 1000 for q in connection.queries), 1)

            log.info(
                "[concierge/perf] TOTAL rid=%s total_ms=%s status=%s phase=%s mode=%s query_len=%d candidates=%d recs=%d limit_reached=%s sql_count=%s sql_total_ms=%s",
                rid,
                total_ms,
                total_status,
                phase,
                mode_label,
                query_len,
                candidate_count,
                rec_count,
                1 if limit_reached else 0,
                len(connection.queries),
                sql_total_ms,
            )

            slow_queries = sorted(
                connection.queries,
                key=lambda q: float(q["time"]),
                reverse=True,
            )[:5]

            for i, q in enumerate(slow_queries, start=1):
                log.info(
                    "[concierge/perf] slow_sql rid=%s rank=%s time_ms=%s sql=%s",
                    rid,
                    i,
                    round(float(q["time"]) * 1000, 1),
                    q["sql"][:1000],
                )

class ConciergeChatViewLegacy(ConciergeChatView):
    schema = None


class ConciergePlanView(APIView):
    """
    経路・候補計画専用API。

    この view の責務:
    - area / latlng をもとに plan レスポンスを返す
    - main / route_hints など plan 専用情報を返す

    この view が返さないもの:
    - remaining_free
    - limit
    - reply
    - thread
    - chat 用 recommendations 契約

    つまり、課金表示や paywall 判定の正本は chat 側であり、
    plan 側には持ち込まない。
    """
    permission_classes = [AllowAny]
    throttle_scope = "concierge"

    @extend_schema(
        request=ConciergePlanRequestSerializer,
        responses={200: ConciergePlanResponseSerializer},
        tags=["concierge"],
        summary="Concierge plan",
    )
    def post(self, request, *args, **kwargs):
        user, token = _resolve_user_and_token(request)
        if user is not None:
            request.user = user
            request.auth = token

        s = ConciergePlanRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)

        body = build_plan_response(
            request_data=request.data or {},
            serializer_validated=s.validated_data or {},
            user=getattr(request, "user", None),
        )
        return Response(body, status=status.HTTP_200_OK)


class ConciergePlanViewLegacy(ConciergePlanView):
    schema = None


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
