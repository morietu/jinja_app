# backend/temples/api/views/goshuin.py
from __future__ import annotations

import logging

from django.db import transaction
from rest_framework import permissions, status, viewsets
from rest_framework.authentication import SessionAuthentication
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication

from temples.models import Goshuin, GoshuinImage
from temples.serializers.routes import GoshuinSerializer, MyGoshuinCreateSerializer

log = logging.getLogger(__name__)

MAX_MY_GOSHUINS = 10


class CsrfExemptSessionAuthentication(SessionAuthentication):
    """SessionAuthentication だけど CSRF チェックをスキップ（開発用）"""
    def enforce_csrf(self, request):
        return


class PublicGoshuinViewSet(viewsets.ReadOnlyModelViewSet):
    """
    GET /api/goshuins/
    GET /api/goshuins/{id}/  ※ router が作る
    公開(is_public=True)のみ
    """
    queryset = (
        Goshuin.objects.filter(is_public=True)
        .select_related("shrine", "user")
        .order_by("-created_at")
    )
    serializer_class = GoshuinSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None  # 配列で返す（現状互換）


class MyGoshuinViewSet(viewsets.ViewSet):
    """
    /api/my/goshuins/ 用（自分の御朱印 CRUD）
    """
    authentication_classes = [JWTAuthentication, CsrfExemptSessionAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        return (
            Goshuin.objects.filter(user=self.request.user)
            .select_related("shrine")
            .order_by("-created_at")
        )

    def list(self, request):
        qs = self.get_queryset()
        return Response(GoshuinSerializer(qs, many=True, context={"request": request}).data)

    def retrieve(self, request, pk=None):
        try:
            obj = self.get_queryset().get(pk=pk)
        except Goshuin.DoesNotExist:
            return Response({"detail": "見つかりません。"}, status=status.HTTP_404_NOT_FOUND)
        return Response(GoshuinSerializer(obj, context={"request": request}).data)

    def create(self, request):
        if self.get_queryset().count() >= MAX_MY_GOSHUINS:
            return Response(
                {
                    "code": "PLAN_LIMIT_EXCEEDED",
                    "limit": MAX_MY_GOSHUINS,
                    "detail": f"御朱印は最大 {MAX_MY_GOSHUINS} 件までです。",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        ser = MyGoshuinCreateSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        goshuin = ser.save()

        out = GoshuinSerializer(goshuin, context={"request": request})
        return Response(out.data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, pk=None):
        try:
            goshuin = self.get_queryset().get(pk=pk)
        except Goshuin.DoesNotExist:
            return Response({"detail": "見つかりません。"}, status=status.HTTP_404_NOT_FOUND)

        is_public_raw = request.data.get("is_public")
        if is_public_raw is not None:
            goshuin.is_public = str(is_public_raw).lower() in ("1", "true", "t", "yes", "y", "on")
            goshuin.save(update_fields=["is_public", "updated_at"])

        return Response(GoshuinSerializer(goshuin, context={"request": request}).data)

    def destroy(self, request, pk=None):
        try:
            goshuin = self.get_queryset().get(pk=pk)
        except Goshuin.DoesNotExist:
            return Response({"detail": "見つかりません。"}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            GoshuinImage.objects.filter(goshuin=goshuin).delete()
            goshuin.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)
