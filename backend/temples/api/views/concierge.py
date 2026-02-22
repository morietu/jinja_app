# backend/temples/api/views/concierge.py
from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework import serializers

from temples.models import ConciergeThread, ConciergeMessage
from drf_spectacular.utils import extend_schema, extend_schema_view


# ---- serializers (schema用。嘘つかない最低限) -------------------------------

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

# ---- views ------------------------------------------------------------------

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
                    "last_message_at": (t.last_message_at.isoformat() if t.last_message_at else None),
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
    permission_classes = [IsAuthenticated]
    throttle_scope = "concierge"

    def get(self, request, pk: int, *args, **kwargs):
        user = request.user
        thread = get_object_or_404(ConciergeThread, pk=pk, user=user)

        msgs = ConciergeMessage.objects.filter(thread=thread).order_by("created_at", "id")

        payload = {
            "id": thread.id,
            "title": thread.title,
            "last_message": _thread_last_message(thread),
            "last_message_at": (thread.last_message_at.isoformat() if thread.last_message_at else None),
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


# ---- helpers ----------------------------------------------------------------

def _thread_last_message(thread: ConciergeThread) -> str | None:
    return (
        ConciergeMessage.objects.filter(thread=thread)
        .order_by("-created_at", "-id")
        .values_list("content", flat=True)
        .first()
    )

def _thread_message_count(thread: ConciergeThread) -> int:
    return ConciergeMessage.objects.filter(thread=thread).count()
