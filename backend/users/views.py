# backend/users/views.py
import logging

from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import UserCreationForm
from django.shortcuts import redirect, render
from django.views import View

from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.generics import GenericAPIView
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from .serializers import MeSerializer
from users.models import UserProfile

log = logging.getLogger(__name__)


class MeView(GenericAPIView):
    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = MeSerializer
    http_method_names = ["get", "patch"]

    def get(self, request, *args, **kwargs):
        # ★ GenericAPIView.get_serializer を使うと context={"request": request} が自動で入る
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)

    def patch(self, request, *args, **kwargs):
        log.info(
            "[MeView.patch] is_authenticated=%s, user=%s, auth=%s",
            getattr(request.user, "is_authenticated", False),
            getattr(request.user, "username", None),
            request.auth,
        )

        # ★ ここも get_serializer を使う（context 付き）
        ser = self.get_serializer(request.user, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        user = ser.save()

        # ★ ログ・レスポンスも get_serializer を通す（context 付き）
        ser_after = self.get_serializer(user)
        log.info(
            "[MeView.patch] updated profile: %s",
            ser_after.data.get("profile"),
        )
        return Response(ser_after.data)


class CurrentUserView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = MeSerializer

    def get(self, request):
        # ★ ここも context 付きになるように get_serializer を使う
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)


class MeIconUploadView(GenericAPIView):
    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, *args, **kwargs):
        from django.utils.datastructures import MultiValueDict

        # ★ 追加：FILES と POST をログ
        log.info("[MeIconUploadView] FILES=%s, POST=%s", request.FILES, request.POST)

        file = request.FILES.get("icon")
        if not file:
            return Response(
                {"detail": "icon ファイルがありません"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        prof, _ = UserProfile.objects.get_or_create(user=request.user)
        prof.icon = file
        prof.save()

        log.info(
            "[MeIconUploadView] uploaded icon for user=%s",
            request.user.username,
        )

        return Response(
            {"icon_url": prof.icon.url},
            status=status.HTTP_200_OK,
        )
