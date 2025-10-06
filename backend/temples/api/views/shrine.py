# temples/api/views/shrine.py
from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.geos import Point
from django.db.models import Q
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from temples.api.queryutils import annotate_is_favorite
from temples.api.serializers.shrine import (
    GoriyakuTagSerializer,
    ShrineDetailSerializer,
    ShrineListSerializer,
)
from temples.models import GoriyakuTag, Shrine


class ShrineViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Shrine.objects.all().prefetch_related("goriyaku_tags")
    permission_classes = [permissions.AllowAny]
    throttle_scope = "shrines"

    # ★ これを追加（ここで使用する Serializer を切り替える）
    def get_serializer_class(self):
        return ShrineListSerializer if self.action == "list" else ShrineDetailSerializer

    def get_queryset(self):
        # ✖️ NG: return ShrineListSerializer if ...  ← これは serializer の選択であって、QuerySet ではない
        qs = self.queryset
        params = self.request.query_params

        q = params.get("q")
        if q:
            qs = qs.filter(
                Q(name_jp__icontains=q)
                | Q(name_romaji__icontains=q)
                | Q(address__icontains=q)
                | Q(goriyaku__icontains=q)
                | Q(goriyaku_tags__name__icontains=q)
            )

        name = params.get("name")
        if name:
            qs = qs.filter(Q(name_jp__icontains=name) | Q(name_romaji__icontains=name))

        for key in ("goriyaku", "shinkaku", "region"):
            vals = params.getlist(key)
            if vals:
                qs = qs.filter(goriyaku_tags__name__in=vals)

        # N+1回避の is_favorite 注釈
        qs = annotate_is_favorite(qs, self.request)

        return qs.distinct()

    @action(
        detail=False, methods=["get"], url_path="nearest", permission_classes=[permissions.AllowAny]
    )
    def nearest(self, request):
        params = request.query_params
        try:
            lat = float(params.get("lat"))
            lng = float(params.get("lng"))
        except (TypeError, ValueError):
            return Response(
                {"detail": "lat and lng are required (float)."}, status=status.HTTP_400_BAD_REQUEST
            )

        if not (-90.0 <= lat <= 90.0 and -180.0 <= lng <= 180.0):
            return Response({"detail": "lat/lng out of range."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            limit = int(params.get("limit", 10))
        except ValueError:
            limit = 10
        limit = max(1, min(limit, 50))

        origin = Point(lng, lat, srid=4326)

        qs = Shrine.objects.exclude(location__isnull=True).annotate(
            distance=Distance("location", origin)
        )

        q = params.get("q")
        if q:
            qs = qs.filter(
                Q(name_jp__icontains=q)
                | Q(name_romaji__icontains=q)
                | Q(address__icontains=q)
                | Q(goriyaku__icontains=q)
                | Q(goriyaku_tags__name__icontains=q)
            )
        for key in ("goriyaku", "shinkaku", "region"):
            vals = params.getlist(key)
            if vals:
                qs = qs.filter(goriyaku_tags__name__in=vals)

        qs = annotate_is_favorite(qs, request).order_by("distance")[:limit]

        data = ShrineListSerializer(qs, many=True, context={"request": request}).data
        return Response(data)


class GoriyakuTagViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = GoriyakuTag.objects.all()
    serializer_class = GoriyakuTagSerializer
    permission_classes = [permissions.AllowAny]
