# backend/temples/api/views/goshuin.py
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt

from rest_framework import viewsets, status
from rest_framework.permissions import AllowAny  # ★ いったん誰でもOKにする
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response

from temples.models import Goshuin
from temples.serializers.routes import GoshuinSerializer


class PublicGoshuinViewSet(viewsets.ReadOnlyModelViewSet):
    """
    公開御朱印一覧用
    GET /api/goshuin/
    GET /api/goshuin/{id}/
    """
    queryset = Goshuin.objects.filter(is_public=True).select_related("shrine")
    serializer_class = GoshuinSerializer
    permission_classes = [AllowAny]


@method_decorator(csrf_exempt, name="dispatch")  # ★ CSRF完全OFF（開発用）
class MyGoshuinViewSet(viewsets.ModelViewSet):
    """
    自分の御朱印一覧＋作成＋削除＋部分更新（開発用に権限をゆるゆるにする）
    """
    serializer_class = GoshuinSerializer
    permission_classes = [AllowAny]  # ★ まずは認証／権限チェックを全部外す
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        # 一旦「全部」返す（本番では user 絞りに戻す）
        return Goshuin.objects.all().select_related("shrine")

    def perform_create(self, serializer):
        # 開発用なので user は null でもOKにしておく（必要なら後で調整）
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        pk = kwargs.get("pk")
        print("=== DEBUG MyGoshuinViewSet.destroy ===")
        print("method:", request.method)
        print("pk:", pk)
        print("user:", request.user)
        print("is_authenticated:", getattr(request.user, "is_authenticated", None))
        print("======================================")

        qs = Goshuin.objects.filter(id=pk)
        deleted, _ = qs.delete()

        if deleted == 0:
            return Response(
                {"detail": "対象の御朱印がありません"},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(status=status.HTTP_204_NO_CONTENT)
