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

from rest_framework.response import Response
from rest_framework import status

from temples.models import Favorite
from temples.api.serializers.favorites import FavoriteSerializer, FavoriteUpsertSerializer


class FavoriteViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated]
    pagination_class = None
    queryset = Favorite.objects.all().order_by("-created_at")

    def get_queryset(self):
        return super().get_queryset().filter(user=self.request.user)

    def get_serializer_class(self):
        return FavoriteUpsertSerializer if getattr(self, "action", None) == "create" else FavoriteSerializer


    def create(self, request, *args, **kwargs):
        # 入力だけ UpsertSerializer で受ける
        s = FavoriteUpsertSerializer(data=request.data, context=self.get_serializer_context())
        s.is_valid(raise_exception=True)
        vd = s.validated_data

        shrine = vd.get("shrine") or vd.get("shrine_id") or vd.get("shrineId")
        place_id = vd.get("place_id") or vd.get("placeId")

        if shrine:
            shrine_id = int(getattr(shrine, "id", shrine))
            obj, created = Favorite.objects.get_or_create(user=request.user, shrine_id=shrine_id)
        elif place_id:
            obj, created = Favorite.objects.get_or_create(user=request.user, place_id=str(place_id))
        else:
            return Response({"detail": "either shrine_id or place_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        # ★返却は必ず FavoriteSerializer（= shrine をネストして返す想定）
        out = FavoriteSerializer(obj, context=self.get_serializer_context()).data
        return Response(out, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
