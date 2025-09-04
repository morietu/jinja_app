# backend/temples/api_views.py
from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication

from .models import Favorite
from .serializers import FavoriteSerializer

class FavoriteViewSet(viewsets.ModelViewSet):
    serializer_class = FavoriteSerializer
    authentication_classes = (JWTAuthentication,)
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        # 自分の分だけ
        return Favorite.objects.filter(user=self.request.user).select_related("shrine")

    # 冪等にしたい場合（重複時に 200/OK で返す）
    def create(self, request, *args, **kwargs):
        shrine_id = request.data.get("shrine_id")
        if shrine_id is None:
            return Response({"detail": "shrine_id is required"}, status=400)

        obj, created = Favorite.objects.get_or_create(
            user=request.user, shrine_id=shrine_id
        )
        serializer = self.get_serializer(obj)
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
