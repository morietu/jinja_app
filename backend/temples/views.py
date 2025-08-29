from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, viewsets, permissions
from .models import Favorite, Shrine   # ← Shrine を追加
from .serializers import FavoriteSerializer


class FavoriteViewSet(viewsets.ModelViewSet):
    serializer_class = FavoriteSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # ログイン中ユーザーのお気に入りだけ返す
        return Favorite.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        # user を自動的にセット
        serializer.save(user=self.request.user)


class FavoriteToggleView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, shrine_id):
        try:
            shrine = Shrine.objects.get(id=shrine_id)
        except Shrine.DoesNotExist:
            return Response({"detail": "Shrine not found"}, status=status.HTTP_404_NOT_FOUND)

        favorite, created = Favorite.objects.get_or_create(
            user=request.user,
            shrine=shrine
        )
        if not created:
            # すでに存在 → 削除
            favorite.delete()
            return Response({"status": "removed", "shrine": shrine_id}, status=status.HTTP_200_OK)

        return Response({"status": "added", "shrine": shrine_id}, status=status.HTTP_201_CREATED)
