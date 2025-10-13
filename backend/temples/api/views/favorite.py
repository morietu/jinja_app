# temples/api/views/favorite.py
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication  # ★ 追加
from temples.models import Favorite, PlaceRef, Shrine

from ..serializers.favorite import FavoriteSerializer


class FavoriteToggleView(APIView):
    """POST /api/favorites/toggle/  { "shrine_id": 1 }"""

    authentication_classes = (JWTAuthentication,)  # ★ JWTのみ → CSRF不要
    permission_classes = (IsAuthenticated,)
    throttle_scope = "favorites"  # ★ スコープ統一

    def post(self, request, *args, **kwargs):
        shrine_id = request.data.get("shrine_id")
        if not shrine_id:
            return Response({"detail": "shrine_id is required"}, status=400)
        try:
            shrine = Shrine.objects.get(pk=shrine_id)
        except Shrine.DoesNotExist:
            return Response({"detail": "Shrine not found"}, status=404)

        fav, created = Favorite.objects.get_or_create(user=request.user, shrine=shrine)
        if created:
            return Response({"favorited": True}, status=status.HTTP_201_CREATED)
        fav.delete()
        return Response({"favorited": False}, status=status.HTTP_200_OK)


class MyFavoritesListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/favorites/"""

    authentication_classes = (JWTAuthentication,)
    permission_classes = (IsAuthenticated,)
    serializer_class = FavoriteSerializer
    throttle_scope = "favorites"

    def get_queryset(self):
        qs = (
            Favorite.objects.filter(user=self.request.user)
            .select_related("shrine")
            .order_by("-created_at")
        )
        # PlaceRef を一括ロード（任意・N+1回避）
        place_ids = list(filter(None, qs.values_list("place_id", flat=True)))
        places_by_id = {}
        if place_ids:
            for pr in PlaceRef.objects.filter(place_id__in=place_ids).only(
                "place_id", "name", "address", "latitude", "longitude"
            ):
                places_by_id[pr.place_id] = pr
        self._places_by_id = places_by_id
        return qs

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        if hasattr(self, "_places_by_id"):
            ctx["places"] = self._places_by_id
        return ctx

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class MyFavoriteDestroyView(generics.DestroyAPIView):
    """DELETE /api/favorites/<favorite_id>/"""

    authentication_classes = (JWTAuthentication,)
    permission_classes = (IsAuthenticated,)
    serializer_class = FavoriteSerializer
    throttle_scope = "favorites"
    lookup_url_kwarg = "favorite_id"

    def get_queryset(self):
        return Favorite.objects.filter(user=self.request.user).select_related("shrine")
