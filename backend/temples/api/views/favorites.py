from rest_framework.authentication import BasicAuthentication
from rest_framework import mixins, viewsets, permissions
from temples.models import Favorite
from temples.api.serializers import FavoriteSerializer
from temples.api.authentication import CsrfExemptSessionAuthentication

class FavoriteViewSet(mixins.CreateModelMixin,
                      mixins.DestroyModelMixin,
                      mixins.ListModelMixin,
                      viewsets.GenericViewSet):
    serializer_class = FavoriteSerializer
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication, BasicAuthentication)

    def get_queryset(self):
        # 自分のものだけ
        return Favorite.objects.filter(user=self.request.user).select_related("shrine")

    def perform_create(self, serializer):
        # リクエストユーザーを強制セット（HiddenField でも入るが二重で安全）
        serializer.save(user=self.request.user)
