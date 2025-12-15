# backend/temples/api/views/goshuin.py
import os 

from django.db import transaction

from rest_framework import permissions, status, viewsets
from rest_framework.authentication import SessionAuthentication
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import ParseError


from temples.models import Goshuin, Shrine, GoshuinImage
from temples.serializers.routes import GoshuinSerializer, MyGoshuinCreateSerializer

from django.contrib.auth import get_user_model
User = get_user_model()


import logging
log = logging.getLogger(__name__)


MAX_MY_GOSHUINS = 10

class CsrfExemptSessionAuthentication(SessionAuthentication):
    """
    SessionAuthentication だけど CSRF チェックをスキップする（開発用）
    """
    def enforce_csrf(self, request):
        return  # 何もしない → CSRF 無効


class PublicGoshuinViewSet(viewsets.ReadOnlyModelViewSet):
    """
    /api/goshuins/ 用
    公開されている御朱印だけ一覧・詳細を返す
    """
    queryset = (
        Goshuin.objects
        .filter(is_public=True)
        .select_related("shrine", "user")
        .order_by("-created_at")
    )
    serializer_class = GoshuinSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None  # 配列で返す


class MyGoshuinViewSet(viewsets.ViewSet):
    """
    /api/my/goshuins/ 用
    ログインユーザー自身の御朱印を CRUD する
    """

    # 本番では基本 JWTAuthentication を使う想定
    authentication_classes = [JWTAuthentication, CsrfExemptSessionAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        return (
            Goshuin.objects
            .filter(user=self.request.user)
            .select_related("shrine")
            .order_by("-created_at")
        )

    def get_serializer_class(self):
        if self.action == "create":
            return MyGoshuinCreateSerializer
        return GoshuinSerializer

    def get_serializer_context(self):
        return {"request": self.request}

    



    # ---- 一覧 ----
    def list(self, request):
        """
        GET /api/my/goshuins/
        """
        try:
            qs = self.get_queryset()
            serializer = GoshuinSerializer(qs, many=True, context={"request": request})
            return Response(serializer.data)
        except Exception as e:
            # 本番でも一旦中身が見えるようにデバッグ用レスポンスを返す
            log.exception("MyGoshuinViewSet.list failed")
            return Response(
                {"detail": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


    def retrieve(self, request, pk=None):
        """
        GET /api/my/goshuins/{id}/
        """
        try:
            obj = self.get_queryset().get(pk=pk)
        except Goshuin.DoesNotExist:
            return Response({"detail": "見つかりません。"}, status=status.HTTP_404_NOT_FOUND)

        serializer = GoshuinSerializer(obj, context={"request": request})
        return Response(serializer.data)

    
    
    # ---- 作成 ----
    def perform_create(self, serializer):
        return serializer.save()

    # ---- 更新（公開/非公開トグル想定） ----
    def partial_update(self, request, pk=None):
        """
        PATCH /api/my/goshuins/{id}/
        今回は is_public だけ想定
        """
        try:
            goshuin = self.get_queryset().get(pk=pk)
        except Goshuin.DoesNotExist:
            return Response({"detail": "見つかりません。"}, status=status.HTTP_404_NOT_FOUND)

        is_public_raw = request.data.get("is_public")
        if is_public_raw is not None:
            is_public = str(is_public_raw).lower() in ("1", "true", "t", "yes", "y", "on")
            goshuin.is_public = is_public
            goshuin.save(update_fields=["is_public", "updated_at"])

        serializer = GoshuinSerializer(goshuin, context={"request": request})
        return Response(serializer.data)

    # ---- 削除 ----
    def destroy(self, request, pk=None):
        """
        DELETE /api/my/goshuins/{id}/
        """
        try:
            goshuin = self.get_queryset().get(pk=pk)
        except Goshuin.DoesNotExist:
            return Response({"detail": "見つかりません。"}, status=status.HTTP_404_NOT_FOUND)

        # 子画像を先に削除してから本体を消す
        with transaction.atomic():
            GoshuinImage.objects.filter(goshuin=goshuin).delete()
            goshuin.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)

    def create(self, request):
        count = self.get_queryset().count()
        if count >= MAX_MY_GOSHUINS:
            return Response(
                {"code": "PLAN_LIMIT_EXCEEDED", "limit": MAX_MY_GOSHUINS, "detail": f"御朱印は最大  {MAX_MY_GOSHUINS} 件までです。"},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = MyGoshuinCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        goshuin = serializer.save()  # user は serializer 側に寄せる or ここで寄せる
        out = GoshuinSerializer(goshuin, context={"request": request})
        return Response(out.data, status=status.HTTP_201_CREATED)
