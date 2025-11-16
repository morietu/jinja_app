# backend/temples/api/views/concierge_history.py
from django.db.models import Count, Max
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import LimitOffsetPagination

from temples.api.serializers.concierge_history import (
    ConciergeThreadListSerializer,
    ConciergeThreadDetailSerializer,
)
from temples.models import ConciergeThread


class ConciergeHistoryPagination(LimitOffsetPagination):
    default_limit = 20
    max_limit = 100


class ConciergeHistoryListView(ListAPIView):
    """
    GET /api/concierges/histories/
      -> LimitOffsetPagination 形式でスレッド一覧を返す
    """

    permission_classes = [IsAuthenticated]
    serializer_class = ConciergeThreadListSerializer
    pagination_class = ConciergeHistoryPagination

    def get_queryset(self):
        return (
            ConciergeThread.objects.filter(user=self.request.user)
            .annotate(
                _message_count=Count("messages"),
                _last_message_at=Max("messages__created_at"),
            )
            .order_by("-_last_message_at", "-id")
        )


class ConciergeHistoryDetailView(RetrieveAPIView):
    """
    GET /api/concierges/histories/{id}/
      -> 1スレッド + messages[]
    """

    permission_classes = [IsAuthenticated]
    serializer_class = ConciergeThreadDetailSerializer

    def get_queryset(self):
        return ConciergeThread.objects.filter(user=self.request.user)
