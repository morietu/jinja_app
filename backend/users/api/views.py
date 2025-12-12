# users/api/views.py
from django.conf import settings
from django.db.models import Sum, Count

from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication
from users.models import UserProfile

from temples.models import GoshuinImage

from .serializers import (
    SignupSerializer,
    UserMeSerializer,
    UserProfileUpdateSerializer,
)


def _storage_limit_bytes() -> int:
    # まずは env がなければ 200MB
    return int(getattr(settings, "STORAGE_LIMIT_BYTES", 200 * 1024 * 1024))

class MeStorageView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = GoshuinImage.objects.filter(goshuin__user=request.user)

        agg = qs.aggregate(
            total_bytes=Sum("size_bytes"),
            total_images=Count("id"),
        )

        total_bytes = int(agg["total_bytes"] or 0)
        total_images = int(agg["total_images"] or 0)

        limit_bytes = _storage_limit_bytes()
        remaining_bytes = max(0, limit_bytes - total_bytes)
        is_over_limit = total_bytes > limit_bytes

        return Response(
            {
                "total_bytes": total_bytes,
                "total_images": total_images,
                "limit_bytes": limit_bytes,
                "remaining_bytes": remaining_bytes,
                "is_over_limit": is_over_limit,
            }
        )


class MeView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    @extend_schema(
        summary="Get current user profile",
        responses={200: UserMeSerializer},
        tags=["users"],
    )
    def get(self, request):
        UserProfile.objects.get_or_create(
            user=request.user,
            defaults={"nickname": request.user.username, "is_public": True},
        )
        return Response(UserMeSerializer(request.user, context={"request": request}).data)

    @extend_schema(
        summary="Update current user profile",
        request=UserProfileUpdateSerializer,
        responses={200: UserMeSerializer},
        tags=["users"],
    )
    def patch(self, request):
        prof, _ = UserProfile.objects.get_or_create(user=request.user)
        ser = UserProfileUpdateSerializer(prof, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(UserMeSerializer(request.user, context={"request": request}).data)


class SignupResponse(serializers.Serializer):
    id = serializers.IntegerField()
    username = serializers.CharField()


class SignupView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        summary="Signup",
        request=SignupSerializer,
        responses={201: SignupResponse},
        tags=["users"],
    )
    def post(self, request):
        s = SignupSerializer(data=request.data)
        if not s.is_valid():
            return Response(s.errors, status=status.HTTP_400_BAD_REQUEST)
        user = s.save()
        return Response({"id": user.id, "username": user.username}, status=status.HTTP_201_CREATED)
