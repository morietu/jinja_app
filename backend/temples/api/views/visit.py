# temples/api/views/visit.py
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import generics, permissions, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from temples.api.serializers.visit import VisitSerializer
from temples.models import Shrine, Visit


class VisitCreateView(APIView):
    permission_classes = [IsAuthenticated]

    # URLの/<int:shrine_id>/ と JSON {shrine_id|shrine} の両対応
    def post(self, request, shrine_id=None, *args, **kwargs):  # noqa: D401
        shrine_id = shrine_id or request.data.get("shrine_id") or request.data.get("shrine")
        if not shrine_id:
            return Response({"detail": "shrine_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            shrine = Shrine.objects.get(pk=shrine_id)
        except Shrine.DoesNotExist:
            return Response({"detail": "Shrine not found"}, status=status.HTTP_404_NOT_FOUND)

        # visited_at は任意（ISO8601文字列）。naiveならローカルTZでawareへ。
        visited_at_raw = request.data.get("visited_at")
        if visited_at_raw:
            dt = parse_datetime(visited_at_raw)
            if dt is None:
                return Response(
                    {"detail": "visited_at must be ISO 8601"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if timezone.is_naive(dt):
                dt = timezone.make_aware(dt, timezone.get_current_timezone())
            visited_at = dt
        else:
            visited_at = timezone.now()

        v = Visit.objects.create(user=request.user, shrine=shrine, visited_at=visited_at)
        # 必要ならシリアライザで返す
        return Response({"id": v.id, "created": True}, status=status.HTTP_201_CREATED)


class UserVisitListView(generics.ListAPIView):
    serializer_class = VisitSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return (
            Visit.objects.filter(user=self.request.user)
            .select_related("shrine")
            .order_by("-visited_at")
        )
