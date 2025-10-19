# users/api/views.py
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication
from users.models import UserProfile

from .serializers import (
    SignupSerializer,
    UserMeSerializer,
    UserProfileUpdateSerializer,
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
