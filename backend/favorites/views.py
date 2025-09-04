from django.shortcuts import render
from rest_framework import viewsets, mixins
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from .models import Favorite
from .serializers import FavoriteSerializer
from .permissions import IsOwner

class FavoriteViewSet(mixins.ListModelMixin,
                      mixins.CreateModelMixin,
                      mixins.DestroyModelMixin,
                      viewsets.GenericViewSet):
    serializer_class = FavoriteSerializer
    permission_classes = [IsAuthenticated]
    queryset = Favorite.objects.all()
    serializer_class = FavoriteSerializer
    authentication_classes = (JWTAuthentication,)
    permission_classes = (IsAuthenticated,)
    

    def get_queryset(self):
        # 自分のものだけ
        return Favorite.objects.select_related("shrine").filter(
            user=self.request.user
        ).order_by("-created_at")

    def get_permissions(self):
        if self.action == "destroy":
            return [IsAuthenticated(), IsOwner()]
        return [IsAuthenticated()]

# Create your views here.
@api_view(["GET"])
@authentication_classes([JWTAuthentication])  # ここで強制
@permission_classes([AllowAny])               # 認可は緩める
def whoami(request):
    u = request.user
    return Response({
        "is_authenticated": u.is_authenticated,
        "id": getattr(u, "id", None),
        "username": getattr(u, "username", None),
    })