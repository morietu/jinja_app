# backend/temples/api/views/concierge.py
from django.shortcuts import get_object_or_404
from django.http import Http404

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

from temples.models import ConciergeThread, ConciergeMessage

from temples.api_views_concierge import (
    chat,
    plan,
    chat_legacy,
    plan_legacy,
    ConciergeChatView,
    ConciergePlanView,
    ConciergeChatViewLegacy,
    ConciergePlanViewLegacy,
)


__all__ = [
    "chat",
    "plan",
    "chat_legacy",
    "plan_legacy",
    "ConciergeChatView",
    "ConciergePlanView",
    "ConciergeChatViewLegacy",
    "ConciergePlanViewLegacy",
    "ConciergeThreadListView",
    "ConciergeThreadDetailView",
]


class ConciergeThreadListView(APIView):
    """
    自分のコンシェルジュスレッド一覧を返す簡易ビュー。
    （既存フロントが使っていない場合でも、schema 生成のために定義しておく）
    """
    permission_classes = [AllowAny]
    throttle_scope = "concierge"

    def get(self, request, *args, **kwargs):
        user = request.user if request.user.is_authenticated else None
        if user is None:
            # 未ログイン時は空配列を返す
            return Response({"results": []}, status=status.HTTP_200_OK)

        qs = (
            ConciergeThread.objects.filter(user=user)
            .order_by("-last_message_at", "-id")
        )

        items = []
        for t in qs[:50]:
            items.append(
                {
                    "id": t.id,
                    "title": t.title,
                    "last_message": t.last_message,
                    "last_message_at": (
                        t.last_message_at.isoformat() if t.last_message_at else None
                    ),
                    "message_count": t.message_count,
                }
            )

        return Response({"results": items}, status=status.HTTP_200_OK)


class ConciergeThreadDetailView(APIView):
    """
    スレッド詳細＋メッセージ一覧。
    schema 生成・最低限の動作が目的なので、シンプルな形にしている。
    """
    permission_classes = [AllowAny]
    throttle_scope = "concierge"

    def get(self, request, pk: int, *args, **kwargs):
        user = request.user if request.user.is_authenticated else None
        if user is None:
            # ログインしていない場合は 404 にしておく
            raise Http404("Thread not found")

        thread = get_object_or_404(ConciergeThread, pk=pk, user=user)

        msgs = (
            ConciergeMessage.objects.filter(thread=thread)
            .order_by("created_at", "id")
        )

        payload = {
            "id": thread.id,
            "title": thread.title,
            "last_message": thread.last_message,
            "last_message_at": (
                thread.last_message_at.isoformat() if thread.last_message_at else None
            ),
            "message_count": thread.message_count,
            "messages": [
                {
                    "id": m.id,
                    "role": m.role,
                    "content": m.content,
                    "created_at": m.created_at.isoformat()
                    if m.created_at
                    else None,
                }
                for m in msgs
            ],
        }

        return Response(payload, status=status.HTTP_200_OK)
