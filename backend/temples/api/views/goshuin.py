# backend/temples/api/views/goshuin.py
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser

from temples.models import Goshuin
from temples.serializers.routes import GoshuinSerializer


class PublicGoshuinViewSet(viewsets.ReadOnlyModelViewSet):
    """
    公開御朱印一覧用（誰でも閲覧可）
    GET /api/goshuin/
    GET /api/goshuin/{id}/
    """
    queryset = Goshuin.objects.filter(is_public=True).select_related("shrine")
    serializer_class = GoshuinSerializer
    # 公開APIなので permission_classes はデフォルト(AllowAny)のままでOK


class MyGoshuinViewSet(viewsets.ModelViewSet):
    """
    自分の御朱印一覧＋作成＋削除＋部分更新
    GET    /api/my/goshuin/
    POST   /api/my/goshuin/
    DELETE /api/my/goshuin/{id}/
    PATCH  /api/my/goshuin/{id}/
    """
    serializer_class = GoshuinSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        return Goshuin.objects.filter(user=self.request.user).select_related("shrine")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
