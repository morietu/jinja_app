from rest_framework import generics, permissions
from users.models import User
from users.serializers import UserSerializer

class CurrentUserView(generics.RetrieveUpdateAPIView):
    """
    /api/users/me/ → ログインユーザーの情報取得・更新
    """
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user
