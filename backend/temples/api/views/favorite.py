# temples/api/views/favorite.py
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from temples.api.serializers.favorite import FavoriteSerializer, FavoriteUpsertSerializer
from temples.models import Favorite, PlaceRef, Shrine


class FavoriteToggleView(APIView):
    """POST /api/temples/favorites/toggle/  { "shrine_id": 1 }"""

    permission_classes = [IsAuthenticated]
    throttle_scope = "user"

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


class UserFavoriteListView(APIView):
    """GET /api/temples/favorites/?q=&goriyaku=&shinkaku=&region=&lat=&lng="""

    permission_classes = [IsAuthenticated]
    throttle_scope = "user"

    def get(self, request):
        # 自分のお気に入り（最新順）。shrine は select_related で N+1 回避
        qs = (
            Favorite.objects.filter(user=request.user)
            .select_related("shrine")  # ★ shrine の N+1 回避
            .order_by("-created_at")
        )

        # place_id をまとめて取得して context に詰める（★ N+1 回避）
        place_ids = [pid for pid in qs.values_list("place_id", flat=True) if pid]
        places_by_id = {}
        if place_ids:
            for pr in PlaceRef.objects.filter(place_id__in=place_ids).only(
                "place_id", "name", "address", "latitude", "longitude"
            ):
                places_by_id[pr.place_id] = pr

        ser = FavoriteSerializer(
            qs, many=True, context={"request": request, "places": places_by_id}
        )
        return Response(ser.data, status=status.HTTP_200_OK)

    def post(self, request):
        s = FavoriteUpsertSerializer(data=request.data, context={"request": request})
        s.is_valid(raise_exception=True)
        fav = s.save()
        # shrine を確実に抱えた状態でシリアライズ
        fav = Favorite.objects.select_related("shrine").get(pk=fav.pk)
        ser = FavoriteSerializer(fav, context={"request": request})
        return Response(ser.data, status=status.HTTP_201_CREATED)
