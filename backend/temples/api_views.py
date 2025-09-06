from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication

from .models import Shrine, Favorite          # ← Shrine を追加
from .serializers import ShrineSerializer, FavoriteSerializer


class ShrineViewSet(viewsets.ReadOnlyModelViewSet):
    """
    GET /api/shrines/
    GET /api/shrines/{id}/
    匿名閲覧OK（書き込みなし）
    """
    queryset = Shrine.objects.all().order_by("id")
    serializer_class = ShrineSerializer
    authentication_classes = [JWTAuthentication]   # 読み取り専用なのであっても可
    permission_classes = [permissions.AllowAny]    # or IsAuthenticatedOrReadOnly


class FavoriteViewSet(viewsets.ModelViewSet):
    """
    /api/favorites/ で自分のお気に入りをCRUD
    POST: {"shrine_id": <int>} を受け付ける（serializerで shrine にマップせず、ここで処理）
    """
    serializer_class = FavoriteSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # 自分の分だけ（神社を同時取得）
        return (
            Favorite.objects
            .select_related("shrine")
            .filter(user=self.request.user)
            .order_by("-id")
        )

    # 冪等: 既存があれば 200、無ければ作成して 201
    def create(self, request, *args, **kwargs):
        shrine_id = request.data.get("shrine_id")
        if shrine_id is None:
            return Response(
                {"detail": "shrine_id is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        obj, created = Favorite.objects.get_or_create(
            user=request.user, shrine_id=shrine_id
        )
        serializer = self.get_serializer(obj)
        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )
