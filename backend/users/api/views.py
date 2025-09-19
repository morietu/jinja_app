from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser

from users.models import UserProfile
from .serializers import UserMeSerializer, UserProfileUpdateSerializer


class MeView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    # JSON も multipart/form-data も受けたいので両方有効化
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get(self, request):
        # 初回アクセスでプロフィールを自動生成
        UserProfile.objects.get_or_create(
            user=request.user,
            defaults={"nickname": request.user.username, "is_public": True},
        )
        return Response(UserMeSerializer(request.user, context={"request": request}).data)

    def patch(self, request):
        prof, _ = UserProfile.objects.get_or_create(user=request.user)
        ser = UserProfileUpdateSerializer(prof, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(UserMeSerializer(request.user, context={"request": request}).data)
