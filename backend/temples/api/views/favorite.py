# temples/api/views/favorite.py
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication
from temples.models import Favorite, Shrine

from ..serializers.favorite import FavoriteSerializer, FavoriteUpsertSerializer


class FavoriteToggleView(APIView):
    """POST /api/favorites/toggle/  { "shrine_id": 1 }"""

    authentication_classes = (JWTAuthentication,)
    permission_classes = (IsAuthenticated,)
    throttle_scope = "favorites"

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
    throttle_scope = "favorites"
    serializer_class = FavoriteSerializer  # 出力用
    queryset = Favorite.objects.select_related("shrine")
    pagination_class = None

    def get_queryset(self):
        return (
            Favorite.objects.filter(user=self.request.user)
            .select_related("shrine")
            .order_by("-created_at")
        )

    def create(self, request, *args, **kwargs):
        up = FavoriteUpsertSerializer(data=request.data, context=self.get_serializer_context())
        up.is_valid(raise_exception=True)
        fav = up.save()  # get_or_create 済み
        fav = Favorite.objects.select_related("shrine").get(pk=fav.pk)
        out = FavoriteSerializer(fav, context=self.get_serializer_context())
        headers = self.get_success_headers(out.data)
        return Response(out.data, status=status.HTTP_201_CREATED, headers=headers)


class MyFavoriteDestroyView(generics.DestroyAPIView):
    """DELETE /api/favorites/<favorite_id>/"""

    authentication_classes = (JWTAuthentication,)
    permission_classes = (IsAuthenticated,)
    throttle_scope = "favorites"
    serializer_class = FavoriteSerializer
    lookup_url_kwarg = "favorite_id"

    def get_queryset(self):
        return Favorite.objects.filter(user=self.request.user).select_related("shrine")
