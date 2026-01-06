# backend/temples/api_views.py
"""
互換レイヤー:
過去の `from temples.api_views import ...` を生かしつつ、
実装は `temples.api.views.*` に寄せていく。
"""

# ✅ concierge だけ（これは実在していて壊れてない）
from .api_views_concierge import ConciergePlanView  # noqa: F401

from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAuthenticated

from temples.models import Favorite
from temples.api.serializers.favorites import FavoriteSerializer, FavoriteUpsertSerializer


class FavoriteViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated]
    queryset = Favorite.objects.all().order_by("-created_at")

    def get_queryset(self):
        return super().get_queryset().filter(user=self.request.user)

    def get_serializer_class(self):
        return FavoriteUpsertSerializer if getattr(self, "action", None) == "create" else FavoriteSerializer
