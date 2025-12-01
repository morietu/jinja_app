# backend/temples/api/views/goshuin.py
from rest_framework import viewsets, permissions
from rest_framework.authentication import SessionAuthentication
from rest_framework.parsers import MultiPartParser, FormParser

from temples.models import Goshuin
from temples.serializers.routes import GoshuinSerializer


class CsrfExemptSessionAuthentication(SessionAuthentication):
    """
    SessionAuthentication だけど CSRF チェックをスキップする（開発用）
    """
    def enforce_csrf(self, request):
        return  # 何もしない → CSRF 無効


class PublicGoshuinViewSet(viewsets.ReadOnlyModelViewSet):
    """
    公開御朱印一覧（誰でも閲覧可）
    """
    serializer_class = GoshuinSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return (
            Goshuin.objects
            .filter(is_public=True)
            .select_related("shrine")
            .order_by("-created_at")
        )


class MyGoshuinViewSet(viewsets.ModelViewSet):
    """
    ログインユーザー自身の御朱印一覧＋作成＋削除＋公開設定更新
    """
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    update = None
    serializer_class = GoshuinSerializer
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        # 自分の御朱印だけ
        return (
            Goshuin.objects
            .filter(user=self.request.user)
            .select_related("shrine")
            .order_by("-created_at")
        )

    def perform_create(self, serializer):
        # 作成時は必ず自分の user をセット
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        # 更新時も user を自分に固定（念のため）
        serializer.save(user=self.request.user)
