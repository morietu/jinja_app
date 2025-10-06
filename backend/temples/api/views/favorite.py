# temples/api/views/favorite.py
from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.geos import Point
from django.db.models import OuterRef, Prefetch, Q, Subquery
from rest_framework import permissions, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from temples.api.queryutils import annotate_is_favorite
from temples.api.serializers.favorite import FavoriteSerializer, FavoriteUpsertSerializer
from temples.api.serializers.shrine import ShrineListSerializer
from temples.models import Favorite, GoriyakuTag, Shrine


class FavoriteToggleView(APIView):
    """POST /api/temples/favorites/toggle/  { "shrine_id": 1 }"""

    permission_classes = [permissions.IsAuthenticated]
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
        params = request.query_params

        # 自分のお気に入りだけ
        fav_ids = Favorite.objects.filter(user=request.user).values_list("shrine_id", flat=True)
        qs = Shrine.objects.filter(id__in=fav_ids).distinct()

        # フリーテキスト
        q = params.get("q")
        if q:
            qs = qs.filter(
                Q(name_jp__icontains=q)
                | Q(name_romaji__icontains=q)
                | Q(address__icontains=q)
                | Q(goriyaku__icontains=q)
                | Q(goriyaku_tags__name__icontains=q)
            )

        # タグ絞り込み
        for key in ("goriyaku", "shinkaku", "region"):
            vals = params.getlist(key)
            if vals:
                qs = qs.filter(goriyaku_tags__name__in=vals)

        # 並び順: 距離 or 追加順
        lat = params.get("lat")
        lng = params.get("lng")
        if lat is not None and lng is not None:
            try:
                lat = float(lat)
                lng = float(lng)
            except (TypeError, ValueError):
                return Response({"detail": "lat/lng must be float."}, status=400)
            if not (-90.0 <= lat <= 90.0 and -180.0 <= lng <= 180.0):
                return Response({"detail": "lat/lng out of range."}, status=400)

            origin = Point(lng, lat, srid=4326)
            qs = (
                qs.exclude(location__isnull=True)
                .annotate(distance=Distance("location", origin))
                .order_by("distance")
            )
        else:
            fav_latest = (
                Favorite.objects.filter(user=request.user, shrine=OuterRef("pk"))
                .order_by("-created_at")
                .values("created_at")[:1]
            )
            qs = qs.annotate(fav_created_at=Subquery(fav_latest)).order_by("-fav_created_at", "-id")

        # 最適化（並び順が決まった後に適用）
        qs = annotate_is_favorite(qs, request)
        qs = qs.only("id", "name_jp", "address", "latitude", "longitude", "location")
        qs = qs.prefetch_related(
            Prefetch("goriyaku_tags", queryset=GoriyakuTag.objects.only("id", "name", "category"))
        )

        data = ShrineListSerializer(qs, many=True, context={"request": request}).data
        return Response(data, status=200)

    def post(self, request):
        s = FavoriteUpsertSerializer(data=request.data, context={"request": request})
        s.is_valid(raise_exception=True)
        fav = s.save()
        # shrine を確実に抱えた状態でシリアライズ
        fav = Favorite.objects.select_related("shrine").get(pk=fav.pk)
        ser = FavoriteSerializer(fav, context={"request": request})
        return Response(ser.data, status=status.HTTP_201_CREATED)
