"""Weekly Compass API（POST /api/compass/weekly/）.

既存 `POST /api/compass/recommendations/`（`api_views_compass.py`）とは別
Endpointであり、既存のrequest/response contractへは一切手を入れない。
既存Endpointへ `weekly_presentation` を足すこともしない。

このViewの責務はHTTPの前後処理だけである:

    Input normalization（既存Compass Viewと同じ素の正規化）
    Owner resolution（既存 plan_service / anonymous_id Authorityの再利用）
    HTTP status
    anonymous cookie
    Response整形

orchestrationは `temples.services.weekly_compass_service`、Shrine hydrationは
`temples.services.weekly_featured_shrines` が持つ。計算ロジックはこのViewへ
再実装しない。

`target_date` / `timezone` は **public request parameterとして受け取らない**。
Weeklyは「現在週」のPresentationであり、基準日はBackend Authority
（settings.TIME_ZONE = Asia/Tokyo の今日）に固定する。
"""

from __future__ import annotations

import logging
import uuid

from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from temples.domain.weekly_presentation import WEEKLY_PRESENTATION_VERSION
from temples.services.anonymous_id import attach_anonymous_cookie
from temples.services.compass_recommendation_orchestrator import STATE_INVALID_PURPOSE
from temples.services.plan_service import resolve_plan_context
from temples.services.weekly_compass_service import resolve_weekly_presentation
from temples.services.weekly_featured_shrines import hydrate_featured_shrines

log = logging.getLogger(__name__)

PLAN_ANONYMOUS = "anonymous"


class CompassWeeklyView(APIView):
    """Weekly Compass Home の主API。

    Authentication / Permission は既存 CompassRecommendationsView と同一
    （AllowAny + JWTAuthentication + throttle_scope="compass"）。Weekly独自の
    認証方式は作らない。
    """

    permission_classes = [AllowAny]
    authentication_classes = [JWTAuthentication]
    throttle_scope = "compass"

    def post(self, request, *args, **kwargs):
        rid = uuid.uuid4().hex[:8]
        data = request.data or {}

        # 既存Compass Viewと同じ素の正規化（巨大Serializerは導入しない）。
        purpose = str(data.get("purpose") or "").strip()
        birthdate = str(data.get("birthdate") or "").strip() or None
        raw_origin = data.get("origin")
        origin = raw_origin if isinstance(raw_origin, dict) else None

        # Owner resolution: 既存Identity Authorityをそのまま使う。
        # authenticated -> request.user / anonymous -> concierge_anon_id
        # Weekly専用Identity（weekly_anon_id 等）は作らない。
        plan_context = resolve_plan_context(request)
        owner_user = request.user if plan_context.is_authenticated else None
        owner_anonymous_id = None if plan_context.is_authenticated else plan_context.anon_id

        try:
            result = resolve_weekly_presentation(
                purpose=purpose,
                birthdate=birthdate,
                origin=origin,
                user=owner_user,
                anonymous_id=owner_anonymous_id,
            )
            featured_shrines = (
                hydrate_featured_shrines(
                    shrine_ids=result.snapshot.featured_shrine_ids,
                    request=request,
                )
                if result.is_success and result.snapshot is not None
                else []
            )
        except Exception:
            # exception詳細もPIIもResponseへ出さない。server logのみへ残す。
            log.exception("[compass/weekly] resolve_failed rid=%s", rid)
            return Response(
                {"state": "error"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        snapshot = result.snapshot
        body = {
            "state": result.state,
            "purpose": result.purpose,
            "week": {
                "start": result.week_start.isoformat(),
                "end": result.week_end.isoformat(),
            },
            "direction_context": result.direction_context,
            "weekly_theme": snapshot.weekly_theme if snapshot is not None else None,
            "featured_shrines": featured_shrines,
            "presentation_version": (
                snapshot.presentation_version
                if snapshot is not None
                else WEEKLY_PRESENTATION_VERSION
            ),
        }

        # Observability: PIIを出さない（birthdate / anonymous_id生値 / email /
        # 正確な座標はいずれも含めない）。owner_kindは種別のみ。
        log.info(
            "[compass/weekly] resolved rid=%s state=%s snapshot=%s owner_kind=%s "
            "week_start=%s purpose=%s weekly_candidate_pool_count=%s featured_shrine_count=%s "
            "stored_featured_count=%s",
            rid,
            result.state,
            "hit" if result.snapshot_hit else ("miss" if snapshot is not None else "none"),
            "user" if plan_context.is_authenticated else PLAN_ANONYMOUS,
            result.week_start.isoformat(),
            result.purpose,
            result.weekly_pool_count,
            len(featured_shrines),
            len(snapshot.featured_shrine_ids or []) if snapshot is not None else 0,
        )

        http_status = (
            status.HTTP_400_BAD_REQUEST
            if result.state == STATE_INVALID_PURPOSE
            else status.HTTP_200_OK
        )
        response = Response(body, status=http_status)

        # Anonymous cookieは既存Authorityへ委譲する。cookie name / salt /
        # max age / SameSite / Secure / HttpOnly をWeekly側で再定義しない。
        if plan_context.plan == PLAN_ANONYMOUS and plan_context.anon_id:
            attach_anonymous_cookie(response, plan_context.anon_id)
            log.info("[compass/weekly] anonymous_cookie_attached rid=%s", rid)

        return response


__all__ = ["CompassWeeklyView"]
