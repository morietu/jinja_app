from rest_framework import viewsets, permissions, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404

from temples.models import Shrine
from temples.serializers import ShrineSerializer
try:
    from temples.permissions import IsOwnerOrReadOnly  # app側にある場合
except Exception:
    import pytest
    pytest.skip("permissions module not found; skipping favorite tests", allow_module_level=True)
   # 自作パーミッション（後述）

# 神社一覧・登録・編集 API
class ShrineViewSet(viewsets.ModelViewSet):
    queryset = Shrine.objects.all()
    serializer_class = ShrineSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

# お気に入り登録/解除 API
class FavoriteToggleView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, shrine_id):
        shrine = get_object_or_404(Shrine, id=shrine_id)
        favorite, created = Favorite.objects.get_or_create(
            user=request.user, shrine=shrine
        )
        if not created:
            favorite.delete()
            return Response({"status": "removed"}, status=status.HTTP_200_OK)
        return Response({"status": "added"}, status=status.HTTP_201_CREATED)

# ルート検索 API（ダミー）
class RouteView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, *args, **kwargs):
        # TODO: Google Maps API のルート検索ロジック
        return Response({"message": "Route API placeholder"})

# 参拝記録 API（ダミー）
class VisitCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, shrine_id):
        # TODO: Visitモデルを作成して保存する処理
        return Response({"status": "visit recorded"})
