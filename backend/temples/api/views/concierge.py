from __future__ import annotations

import logging
import time

from django.db import connection, reset_queries
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from temples.models import ConciergeMessage, ConciergeThread
from temples.services.anonymous_id import get_anonymous_id

logger = logging.getLogger(__name__)


class ConciergeThreadListItemSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    title = serializers.CharField(allow_blank=True, required=False)
    last_message = serializers.CharField(allow_null=True, required=False)
    last_message_at = serializers.CharField(allow_null=True, required=False)
    message_count = serializers.IntegerField()


class ConciergeThreadListResponseSerializer(serializers.Serializer):
    results = ConciergeThreadListItemSerializer(many=True)


class ConciergeMessageSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    role = serializers.CharField()
    content = serializers.CharField()
    created_at = serializers.CharField(allow_null=True, required=False)


class ConciergeThreadDetailResponseSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    title = serializers.CharField(allow_blank=True, required=False)
    last_message = serializers.CharField(allow_null=True, required=False)
    last_message_at = serializers.CharField(allow_null=True, required=False)
    message_count = serializers.IntegerField()
    messages = ConciergeMessageSerializer(many=True)
    recommendations = serializers.JSONField(required=False, allow_null=True)
    recommendations_v2 = serializers.JSONField(required=False, allow_null=True)


@extend_schema_view(
    get=extend_schema(
        operation_id="api_concierge_threads_list",
        responses={200: ConciergeThreadListResponseSerializer},
        tags=["concierge"],
    )
)
class ConciergeThreadListView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_scope = "concierge"

    def get(self, request, *args, **kwargs):
        user = request.user
        qs = ConciergeThread.objects.filter(user=user).order_by("-last_message_at", "-id")

        items = []
        for t in qs[:50]:
            items.append(
                {
                    "id": t.id,
                    "title": t.title,
                    "last_message": _thread_last_message(t),
                    "last_message_at": t.last_message_at.isoformat() if t.last_message_at else None,
                    "message_count": _thread_message_count(t),
                }
            )

        return Response({"results": items}, status=status.HTTP_200_OK)


@extend_schema_view(
    get=extend_schema(
        operation_id="api_concierge_threads_detail",
        responses={200: ConciergeThreadDetailResponseSerializer},
        tags=["concierge"],
    )
)
class ConciergeThreadDetailView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "concierge"

    def get(self, request, pk: int, *args, **kwargs):
        reset_queries()
        started = time.perf_counter()

        try:
            qs = ConciergeThread.objects.filter(pk=pk)

            user = getattr(request, "user", None)
            if user is not None and getattr(user, "is_authenticated", False):
                qs = qs.filter(user=user)
            else:
                raw_req = getattr(request, "_request", None)
                anonymous_id = get_anonymous_id(request) or (get_anonymous_id(raw_req) if raw_req else None)

                print(
                    "THREAD_DETAIL_DEBUG",
                    {
                        "pk": pk,
                        "is_authenticated": bool(getattr(user, "is_authenticated", False)),
                        "cookies": dict(getattr(request, "COOKIES", {}) or {}),
                        "_request_cookies": dict(getattr(raw_req, "COOKIES", {}) or {}) if raw_req else None,
                        "anonymous_id": anonymous_id,
                    },
                )

                print(
                    "THREAD_DETAIL_QUERYSET",
                    {
                        "pk": pk,
                        "is_authenticated": bool(getattr(user, "is_authenticated", False)),
                        "queryset_filter": (
                            {"user_id": getattr(user, "id", None)}
                            if user is not None and getattr(user, "is_authenticated", False)
                            else {"user__isnull": True, "anonymous_id": anonymous_id}
                        ),
                    },
                )

                if not anonymous_id:
                    return Response({"detail": "not found"}, status=status.HTTP_404_NOT_FOUND)

                qs = qs.filter(user__isnull=True, anonymous_id=anonymous_id)

            thread = get_object_or_404(qs)
            msgs = ConciergeMessage.objects.filter(thread=thread).order_by("created_at", "id")

            payload = {
                "id": thread.id,
                "title": thread.title,
                "last_message": _thread_last_message(thread),
                "last_message_at": thread.last_message_at.isoformat() if thread.last_message_at else None,
                "message_count": msgs.count(),
                "messages": [
                    {
                        "id": m.id,
                        "role": m.role,
                        "content": m.content,
                        "created_at": m.created_at.isoformat() if m.created_at else None,
                    }
                    for m in msgs
                ],
                "recommendations": getattr(thread, "recommendations", None),
                "recommendations_v2": getattr(thread, "recommendations_v2", None),
            }
            return Response(payload, status=status.HTTP_200_OK)

        finally:
            total_ms = round((time.perf_counter() - started) * 1000, 1)
            sql_total_ms = round(sum(float(q["time"]) * 1000 for q in connection.queries), 1)

            logger.info(
                "[perf] thread_detail total_ms=%s sql_count=%s sql_total_ms=%s pk=%s",
                total_ms,
                len(connection.queries),
                sql_total_ms,
                pk,
            )

            slow_queries = sorted(
                connection.queries,
                key=lambda q: float(q["time"]),
                reverse=True,
            )[:5]

            for i, q in enumerate(slow_queries, start=1):
                logger.info(
                    "[perf] slow_sql rank=%s time_ms=%s sql=%s",
                    i,
                    round(float(q["time"]) * 1000, 1),
                    q["sql"][:1000],
                )


def _thread_last_message(thread: ConciergeThread) -> str | None:
    return (
        ConciergeMessage.objects.filter(thread=thread)
        .order_by("-created_at", "-id")
        .values_list("content", flat=True)
        .first()
    )


def _thread_message_count(thread: ConciergeThread) -> int:
    return ConciergeMessage.objects.filter(thread=thread).count()
