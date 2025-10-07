# backend/temples/api/views/shrine.py
import math
from datetime import timedelta

from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.geos import Point
from django.db.models import Count, ExpressionWrapper, F, FloatField, Q, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from temples.api.queryutils import annotate_is_favorite
from temples.api.serializers.shrine import (
    GoriyakuTagSerializer,
    ShrineDetailSerializer,
    ShrineListSerializer,
)
from temples.models import GoriyakuTag, Shrine


class ShrineViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Shrine.objects.all().prefetch_related("goriyaku_tags", "deities")
    permission_classes = [permissions.AllowAny]
    throttle_scope = "shrines"

    def get_serializer_class(self):
        return ShrineListSerializer if self.action == "list" else ShrineDetailSerializer

    def get_queryset(self):
        qs = self.queryset
        params = self.request.query_params

        # kind（既定 all → shrine/temple 指定時のみ絞る）
        kind = (params.get("kind") or "all").lower()
        if kind in ("shrine", "temple"):
            qs = qs.filter(kind=kind)
        elif kind != "all":
            qs = qs.filter(kind="shrine")

        # フリーワード
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

        # 九星
        ky_vals = [v for v in params.getlist("kyusei") if v]
        if ky_vals:
            qs = qs.filter(kyusei__in=ky_vals)

        # 御祭神（AND/OR）
        deity_vals = [v for v in params.getlist("deity") if v]
        if deity_vals:
            mode_and = params.get("deity_mode", "").lower() == "and" or params.get(
                "deity_and", ""
            ) in ("1", "true", "yes")

            def term_q(term: str) -> Q:
                t = (term or "").strip()
                if not t:
                    return Q()
                return (
                    Q(deities__name__icontains=t)
                    | Q(deities__kana__icontains=t)
                    | Q(deities__aliases__icontains=t)
                )

            if mode_and:
                for dv in deity_vals:
                    qs = qs.filter(term_q(dv))
            else:
                qd = Q()
                for dv in deity_vals:
                    qd |= term_q(dv)
                qs = qs.filter(qd)

        # お気に入り注釈
        qs = annotate_is_favorite(qs, self.request)

        # retrieve は元クエリセットを返す（フィルタ無し）
        if getattr(self, "action", None) == "retrieve":
            return self.queryset

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
                {"detail": "lat and lng are required (float)."},
                status=status.HTTP_400_BAD_REQUEST,
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

        # kind（既定 shrine）
        kind = (params.get("kind") or "shrine").lower()
        if kind in ("shrine", "temple"):
            qs = qs.filter(kind=kind)
        elif kind != "all":
            qs = qs.filter(kind="shrine")

        # 基本フィルタ
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

        # 九星
        ky_vals = [v for v in params.getlist("kyusei") if v]
        if ky_vals:
            qs = qs.filter(kyusei__in=ky_vals)

        # 御祭神（AND/OR）
        deity_vals = [v for v in params.getlist("deity") if v]
        if deity_vals:
            mode_and = params.get("deity_mode", "").lower() == "and" or params.get(
                "deity_and", ""
            ) in ("1", "true", "yes")

            def term_q(term: str) -> Q:
                t = (term or "").strip()
                if not t:
                    return Q()
                return (
                    Q(deities__name__icontains=t)
                    | Q(deities__kana__icontains=t)
                    | Q(deities__aliases__icontains=t)
                )

            if mode_and:
                for dv in deity_vals:
                    qs = qs.filter(term_q(dv))
            else:
                qd = Q()
                for dv in deity_vals:
                    qd |= term_q(dv)
                qs = qs.filter(qd)

        qs = annotate_is_favorite(qs, request).order_by("distance")[:limit]
        data = ShrineListSerializer(qs, many=True, context={"request": request}).data
        return Response(data)


class RankingAPIView(ListAPIView):
    serializer_class = ShrineListSerializer
    permission_classes = [AllowAny]
    throttle_scope = "shrines"

    def get_queryset(self):
        now = timezone.now()
        since = now - timedelta(days=30)

        qs = Shrine.objects.all()

        # kind（既定 shrine / ?kind=temple / ?kind=all）
        params = self.request.query_params
        kind = (params.get("kind") or "shrine").lower()
        if kind in ("shrine", "temple"):
            qs = qs.filter(kind=kind)
        elif kind != "all":
            qs = qs.filter(kind="shrine")

        # BBOX（near=LAT,LNG & radius_km=R）
        near = params.get("near")
        radius_km = params.get("radius_km")
        if near and radius_km:
            try:
                lat0, lng0 = [float(x) for x in near.split(",", 1)]
                r = float(radius_km)
                lat_delta = r / 111.0
                lng_delta = r / (111.0 * max(0.1, math.cos(math.radians(lat0))))
                qs = qs.filter(
                    latitude__gte=lat0 - lat_delta,
                    latitude__lte=lat0 + lat_delta,
                    longitude__gte=lng0 - lng_delta,
                    longitude__lte=lng0 + lng_delta,
                )
            except Exception:
                pass  # パラメータ不正は黙って無視

        # 合成スコア： 直近30日の訪問(×2.0) + popular_score(×0.5)
        qs = (
            qs.annotate(
                visit_count_30d=Coalesce(
                    Count("visits", filter=Q(visits__visited_at__gte=since)), 0
                ),
                popular_val=Coalesce(F("popular_score"), Value(0.0)),
            )
            .annotate(
                composite_score=ExpressionWrapper(
                    F("visit_count_30d") * Value(2.0) + F("popular_val") * Value(0.5),
                    output_field=FloatField(),
                )
            )
            .order_by("-composite_score", "-id")
        )
        return qs

    def list(self, request, *args, **kwargs):
        try:
            limit = int(request.GET.get("limit", 10))
        except Exception:
            limit = 10
        limit = max(1, min(50, limit))
        data = self.get_serializer(
            self.get_queryset()[:limit], many=True, context={"request": request}
        ).data
        return Response({"items": data})


class GoriyakuTagViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = GoriyakuTag.objects.all()
    serializer_class = GoriyakuTagSerializer
    permission_classes = [permissions.AllowAny]
