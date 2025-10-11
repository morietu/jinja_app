# backend/temples/api/views/concierge_history.py
from rest_framework.generics import ListCreateAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from temples.api.serializers.concierge_history import ConciergeHistorySerializer
from temples.models import ConciergeHistory


class ConciergeHistoryView(ListCreateAPIView):
    """
    GET /api/concierge/history/        -> {"items": [...]}  （自身の履歴のみ、降順）
    POST /api/concierge/history/       -> 1件作成（userは強制的に現在ユーザー）
    """

    permission_classes = [IsAuthenticated]
    serializer_class = ConciergeHistorySerializer

    def get_queryset(self):
        # 自分の履歴だけ、最新順
        return ConciergeHistory.objects.filter(user=self.request.user).order_by("-created_at")

    # レスポンスを {"items": [...]} に包む
    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()[:50]  # 必要なら件数制限
        data = self.get_serializer(qs, many=True).data
        return Response({"items": data})

    # 作成時に user を強制セット
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
