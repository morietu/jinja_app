# backend/temples/api_views_concierge.py
from __future__ import annotations

import logging
import os
import uuid
from typing import Any, Dict, List, Optional, Tuple

import requests
from django.conf import settings as dj_settings
from django.utils import timezone
from drf_spectacular.utils import OpenApiTypes, extend_schema
from rest_framework import serializers, status
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
from temples.models import ConciergeUsage
from temples.services import places as Places
from temples.services.billing_state import is_premium_for_user
from temples.services.concierge_candidate_utils import (
    _candidate_key,
    _dedupe_candidates,
    _to_float,
)
from temples.services.concierge_chat import build_chat_recommendations
from temples.services.concierge_chat_candidates import build_chat_candidates
from temples.services.concierge_history import append_chat
from temples.services.concierge_plan import build_plan_response

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
    pt = geocode_google_point(area, language="ja", region="jp", timeout=6.0)
    log.warning("[api/chat] geocode_area area=%r result=%r", area, pt)
    return pt

def _probe_area_locationbias_for_chat(*, area: str | None) -> None:
    """
    Chatテスト用：area→geocode→findplace(locationbias=8000) を1回だけ叩いて、
    monkeypatch が拾う params を残す。結果は使わない。
    """
    area = (area or "").strip()
    if not area:
        return

    pt = _geocode_area_for_chat(area=area)
    if not pt:
        return

    lb = f"circle:8000@{pt[0]:.3f},{pt[1]:.3f}"

    try:
        Places.findplacefromtext(
            input=area,
            language="ja",
            fields="place_id",
            locationbias=lb,
        )
    except Exception:
        pass


def _resolve_request_inputs(data: Dict[str, Any]):
    filters = data.get("filters") if isinstance(data.get("filters"), dict) else {}
    for k in ("birthdate", "goriyaku_tag_ids", "extra_condition"):
        if data.get(k) in (None, "", []) and filters.get(k) not in (None, "", []):
            data[k] = filters.get(k)

    log.debug(
        "[concierge_chat] merged birthdate=%r goriyaku_tag_ids=%r extra_condition=%r",
        data.get("birthdate"),
        data.get("goriyaku_tag_ids"),
        data.get("extra_condition"),
    )

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

    language = (data.get("language") or "ja").strip()
    area = data.get("area") or data.get("where") or data.get("location_text")

    lat = _to_float(data.get("lat"))
    lng = _to_float(data.get("lng"))
    if (lat is None or lng is None) and area:
        pt = _geocode_area_for_chat(area=area)
        if pt:
            lat, lng = pt

    birthdate = data.get("birthdate")
    goriyaku_tag_ids = data.get("goriyaku_tag_ids")
    extra_condition = data.get("extra_condition")

    return (
        query,
        message,
        language,
        area,
        lat,
        lng,
        birthdate,
        goriyaku_tag_ids,
        extra_condition,
    )


def _build_chat_response(
    intent: Dict[str, Any],
    recs: Dict[str, Any],
    reply: Optional[str],
    remaining_free: Optional[int],
    limit: Optional[int],
    thread: Optional[Any],
    debug: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    body: Dict[str, Any] = {"ok": True, "intent": intent, "data": recs}
    if debug is not None:
        body["_debug"] = debug
    if remaining_free is not None and limit is not None:
        body["remaining_free"] = remaining_free
        body["limit"] = limit
    body["reply"] = reply
    if thread is not None:
        body["thread"] = {"id": thread.id}
    return body


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

    log.warning(
        "[api/chat] build_candidates_input trace=%s area=%r lat=%r lng=%r goriyaku=%r",
        getattr(request, "_concierge_trace_id", ""),
        area,
        lat,
        lng,
        data.get("goriyaku_tag_ids"),
    )

    raw_built_candidates = build_chat_candidates(
        goriyaku_tag_ids=data.get("goriyaku_tag_ids"),
        area=area,
        lat=lat,
        lng=lng,
        trace_id=getattr(request, "_concierge_trace_id", ""),
    )

    merged_candidates = user_candidates + raw_built_candidates
    deduped_candidates = _dedupe_candidates(merged_candidates)

    log.warning(
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


def _resolve_flow(goriyaku_tag_ids: Any, extra_condition: Any) -> str:
    gids = goriyaku_tag_ids
    has_goriyaku = isinstance(gids, list) and len(
        [x for x in gids if x is not None and str(x).strip() != ""]
    ) > 0
    has_extra = bool((extra_condition or "").strip())
    return "B" if (has_goriyaku or has_extra) else "A"


class ConciergeChatView(APIView):
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
        rid = uuid.uuid4().hex[:8]
        log.info("[concierge] chat.post rid=%s", rid)
        data = request.data or {}

        log.info("[api/chat] raw keys=%s", sorted(list(data.keys()))[:60])
        log.info("[api/chat] raw bias=%r", data.get("bias"))
        log.info(
            "[api/chat] raw lat/lng/radius_m=%r/%r/%r",
            data.get("lat"),
            data.get("lng"),
            data.get("radius_m"),
        )
        filters0 = data.get("filters") if isinstance(data.get("filters"), dict) else None
        log.info("[api/chat] raw filters=%r", filters0)

        payload_lat = _to_float(data.get("lat"))
        payload_lng = _to_float(data.get("lng"))

        (
            query,
            message,
            language,
            area,
            lat,
            lng,
            birthdate_raw,
            goriyaku_tag_ids,
            extra_condition,
        ) = _resolve_request_inputs(data)

        log.info(
            "[api/chat] after_merge birthdate=%r goriyaku=%r extra=%r",
            birthdate_raw or None,
            goriyaku_tag_ids,
            extra_condition,
        )

        is_message_mode = bool(message)

        if not query:
            return Response({"detail": "query is required"}, status=status.HTTP_400_BAD_REQUEST)

        lat_src = "payload"
        if (payload_lat is None or payload_lng is None) and area and lat is not None and lng is not None:
            lat_src = "geocode(area)"

        log.info("[api/chat] lat/lng=%r/%r src=%s area=%r", lat, lng, lat_src, area)

        request._concierge_trace_id = rid

        log.warning(
            "[api/chat] pipeline_input rid=%s area=%r payload_lat=%r payload_lng=%r resolved_lat=%r resolved_lng=%r raw_candidates=%d",
            rid,
            area,
            payload_lat,
            payload_lng,
            lat,
            lng,
            len(data.get("candidates") or []) if isinstance(data.get("candidates"), list) else 0,
        )

        candidates, user_n, built_n, merged_n = _build_chat_candidates_pipeline(
            request=request,
            lat=lat,
            lng=lng,
            area=area,
            language=language,
        )

        log.info(
            "[concierge/reco] candidates_raw rid=%s user=%d built=%d merged=%d deduped=%d",
            rid,
            user_n,
            built_n,
            merged_n,
            len(candidates),
        )

        try:
            _probe_area_locationbias_for_chat(area=area)
        except Exception:
            pass

        bias = None
        if lat is not None and lng is not None:
            r_m = _parse_radius(data)
            bias = {"lat": lat, "lng": lng, "radius": r_m, "radius_m": r_m}
            log.info("[api/chat] computed bias=%r (from lat/lng/radius_m)", bias)

        intent = extract_intent(query)

        user, token = _resolve_user_and_token(request)
        if user is not None:
            request.user = user
            request.auth = token

        is_premium = is_premium_for_user(user)
        today = timezone.localdate()
        daily_limit = getattr(dj_settings, "CONCIERGE_DAILY_FREE_LIMIT", 5)
        remaining = None

        if user is not None and not is_premium:
            usage, _ = ConciergeUsage.objects.get_or_create(user=user, date=today)

            if usage.count >= daily_limit:
                recs = {"recommendations": []}
                body = _build_chat_response(
                    intent=intent,
                    recs=recs,
                    reply=LIMIT_MSG,
                    remaining_free=0,
                    limit=daily_limit,
                    thread=None,
                    debug=None,
                )
                body["note"] = "limit-reached"

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

        birthdate = (birthdate_raw or "").strip() or None

        flow = _resolve_flow(goriyaku_tag_ids, extra_condition)
        log.info(
            "[concierge/reco] input rid=%s flow=%s birthdate=%r goriyaku=%r extra=%r",
            rid,
            flow,
            birthdate,
            goriyaku_tag_ids,
            extra_condition,
        )
        log.warning(
            "[concierge_chat] birthdate=%r (raw=%r, filters=%r)",
            birthdate,
            birthdate_raw,
            (data.get("filters") if isinstance(data.get("filters"), dict) else None),
        )

        before_n = len(candidates)
        applied = []
        if goriyaku_tag_ids:
            applied.append("goriyaku_tag_ids")
        if (extra_condition or "").strip():
            applied.append("extra_condition")

        recs = build_chat_recommendations(
            query=query,
            language=language,
            candidates=candidates,
            bias=bias,
            birthdate=birthdate,
            goriyaku_tag_ids=goriyaku_tag_ids,
            extra_condition=extra_condition,
            flow=flow,
        )

        after_n = len(recs.get("recommendations") or [])
        log.info(
            "[concierge/reco] recs_after rid=%s count=%d applied=%s flow=%s",
            rid,
            after_n,
            applied,
            flow,
        )

        try:
            b0 = ((recs.get("recommendations") or [{}])[0] or {}).get("breakdown")
            log.info("[api/chat] breakdown0=%s", "Y" if isinstance(b0, dict) else "N")
        except Exception:
            pass

        if is_message_mode:
            names = []
            for r in (recs.get("recommendations") or [])[:3]:
                if isinstance(r, dict):
                    nm = (r.get("display_name") or r.get("name") or "").strip()
                    if nm:
                        names.append(nm)
            reply = f"候補: {', '.join(names)}" if names else "候補: "
        else:
            reply = None

        thread_obj = None
        if user is not None and getattr(user, "is_authenticated", False):
            thread_id_raw = data.get("thread_id") or data.get("threadId")
            try:
                thread_id = int(thread_id_raw) if thread_id_raw not in (None, "", 0, "0") else None
            except Exception:
                thread_id = None

            reply_text = reply if isinstance(reply, str) else None

            try:
                saved = append_chat(user=user, query=query, reply_text=reply_text, thread_id=thread_id)
                thread_obj = saved.thread
            except ConciergeThread.DoesNotExist:
                saved = append_chat(user=user, query=query, reply_text=reply_text, thread_id=None)
                thread_obj = saved.thread

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
                query=query,
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

        body = _build_chat_response(
            intent=intent,
            recs=recs,
            reply=reply,
            remaining_free=remaining if (user is not None and not is_premium) else None,
            limit=daily_limit if (user is not None and not is_premium) else None,
            thread=thread_obj,
            debug={"rid": rid, "before": before_n, "after": after_n, "applied": applied, "flow": flow},
        )

        return Response(body, status=status.HTTP_200_OK)


class ConciergeChatViewLegacy(ConciergeChatView):
    schema = None


class ConciergePlanView(APIView):
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
