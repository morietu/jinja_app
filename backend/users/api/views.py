# users/api/views.py
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication

from users.serializers import UserSerializer

class CurrentUserView(generics.RetrieveUpdateAPIView):
    """
    /api/auth/me/ → ログインユーザーの取得・更新
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user
