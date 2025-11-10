# -*- coding: utf-8 -*-

import math
from datetime import timedelta
from typing import List, Tuple

from django.conf import settings
from django.db import connection
from django.db.models import (
    Case,
    Count,
    ExpressionWrapper,
    F,
    FloatField,
    IntegerField,
    Q,
    Value,
    When,
)
from django.db.models.expressions import RawSQL
from django.db.models.functions import Coalesce
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

# 既にあればスキップ
from temples.api.serializers.shrine import ShrineDetailSerializer, ShrineListSerializer
from temples.geo_utils import to_lon_lat
from temples.models import Shrine

try:
    from temples.api.utils import annotate_is_favorite
except Exception:

    def annotate_is_favorite(qs, request):
        return qs


EARTH_RADIUS_M = 6371000.0

try:
    from temples.api.utils import annotate_is_favorite
except Exception:

    def annotate_is_favorite(qs, request):
        return qs


def _use_real_gis() -> bool:
    return bool(getattr(settings, "USE_GIS", False)) and not bool(
        getattr(settings, "DISABLE_GIS_FOR_TESTS", False)
    )


__all__ = ["nearest_queryset", "nearest_shrines"]


def nearest_queryset(lon: float, lat: float):
    """
    近傍の距離を注釈して距離昇順で返す QuerySet（スライスや半径フィルタはしない）
    - PostGIS: KNN + ST_DistanceSphere
    - NoGIS(PostgreSQL): ハバースイン式で注釈
    - それ以外(SQLite等): 空
    """
    qs = Shrine.objects.all()

    if _use_real_gis():
        point_sql = "ST_SetSRID(ST_Point(%s,%s), 4326)"
        point_params = [lon, lat]
        return (
            qs.filter(location__isnull=False)
            .annotate(
                distance_m=RawSQL(f"ST_DistanceSphere(location, {point_sql})", point_params),
                _knn=RawSQL(f"location <-> {point_sql}", point_params),
            )
            .order_by("_knn", "distance_m")
        )

    if connection.vendor == "postgresql":
        haversine_sql = f"""
            {2*EARTH_RADIUS_M} * ASIN(
                SQRT(
                    POWER(SIN(RADIANS((latitude - %s)/2)), 2) +
                    COS(RADIANS(latitude)) * COS(RADIANS(%s)) *
                    POWER(SIN(RADIANS((longitude - %s)/2)), 2)
                )
            )
        """
        return (
            qs.filter(latitude__isnull=False, longitude__isnull=False)
            .annotate(distance_m=RawSQL(haversine_sql, params=[lat, lat, lon]))
            .order_by("distance_m")
        )

    return Shrine.objects.none()


def nearest_shrines(lon: float, lat: float, limit: int = 20, radius_m: int | None = None):
    """
    近傍神社を距離順で返す。
    - PostGIS: KNN(<->) + ST_DistanceSphere を d_m として注釈し、d_m で絞り込み/並び替え
    - NoGIS(PostgreSQL): ハバースイン距離を d_m として注釈し、d_m で絞り込み/並び替え
    - SQLite 等: Python 側で距離計算
    """
    # ---------- PostGIS あり ----------
    if _use_real_gis():
        point_sql = "ST_SetSRID(ST_Point(%s,%s), 4326)"
        point_params = (lon, lat)

        qs = Shrine.objects.filter(location__isnull=False).annotate(
            _knn=RawSQL(f"location <-> {point_sql}", point_params),
            # テスト互換：d_m を主要距離にし、distance_m も互換用に保持
            d_m=RawSQL(f"ST_DistanceSphere(location, {point_sql})", point_params),
            distance_m=RawSQL(f"ST_DistanceSphere(location, {point_sql})", point_params),
        )

        if radius_m is not None:
            qs = qs.filter(d_m__lte=float(radius_m))

        return qs.order_by("_knn", "d_m")[:limit]

    # ---------- NoGIS: PostgreSQL ----------
    if connection.vendor == "postgresql":
        haversine_sql = f"""
            {2*EARTH_RADIUS_M} * ASIN(
                SQRT(
                    POWER(SIN(RADIANS((latitude - %s)/2)), 2) +
                    COS(RADIANS(latitude)) * COS(RADIANS(%s)) *
                    POWER(SIN(RADIANS((longitude - %s)/2)), 2)
                )
            )
        """
        qs = Shrine.objects.filter(latitude__isnull=False, longitude__isnull=False).annotate(
            d_m=RawSQL(haversine_sql, params=[lat, lat, lon])
        )
        if radius_m is not None:
            qs = qs.filter(d_m__lte=float(radius_m))
        return qs.order_by("d_m")[:limit]

    # ---------- SQLite 等: Python フォールバック ----------
    base_qs = Shrine.objects.filter(location__isnull=False)

    def haversine_m(lon1, lat1, lon2, lat2):
        R = EARTH_RADIUS_M
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlambda = math.radians(lon2 - lon1)
        a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c

    distances: List[Tuple[int, float]] = []
    for obj in base_qs:
        lonlat = to_lon_lat(obj.location)
        if not lonlat:
            continue
        obj_lon, obj_lat = lonlat
        d = haversine_m(lon, lat, obj_lon, obj_lat)
        if radius_m is not None and d > float(radius_m):
            continue
        distances.append((obj.id, d))

    distances.sort(key=lambda t: t[1])
    distances = distances[:limit]
    if not distances:
        return base_qs.none()

    ids_ordered = [pk for pk, _ in distances]
    when_order = [When(id=pk, then=Value(i)) for i, pk in enumerate(ids_ordered)]
    when_dist = [When(id=pk, then=Value(dist)) for pk, dist in distances]

    return (
        Shrine.objects.filter(id__in=ids_ordered)
        .annotate(ordering=Case(*when_order, output_field=IntegerField()))
        .annotate(distance_m=Case(*when_dist, output_field=FloatField()))
        .order_by("ordering")
    )


# ---- Backward-compat: APIView shim for legacy route ----


class NearestShrinesAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        q = request.query_params

        # lat / lng(lon) の取得と検証
        lat_raw = q.get("lat") or q.get("latitude")
        lng_raw = q.get("lng") or q.get("lon") or q.get("longitude")
        if lat_raw is None or lng_raw is None:
            return Response({"detail": "lat and lng(lon) are required."}, status=400)
        try:
            lat = float(lat_raw)
            lng = float(lng_raw)
        except ValueError:
            return Response({"detail": "lat/lng must be float."}, status=400)

        # 任意パラメータ
        radius_raw = q.get("radius")
        limit_raw = q.get("limit")
        try:
            radius_m = int(radius_raw) if radius_raw is not None else None
        except ValueError:
            return Response({"detail": "radius must be int (meters)."}, status=400)
        try:
            limit = int(limit_raw) if limit_raw is not None else 20
        except ValueError:
            return Response({"detail": "limit must be int."}, status=400)
        if limit <= 0:  # ガード
            limit = 1
        if limit > 100:
            limit = 100
        if radius_m is not None and radius_m <= 0:
            return Response({"detail": "radius must be > 0."}, status=400)

        # クエリ実行（queries に集約）
        from temples.queries import nearest_shrines

        qs = nearest_shrines(lon=lng, lat=lat, limit=limit, radius_m=radius_m)

        # 既存テスト互換：distance_m または d_m を数値で返す
        results = []
        for s in qs:
            dist = getattr(s, "distance_m", getattr(s, "d_m", None))
            if dist is not None:
                try:
                    dist = int(dist)
                except Exception:
                    pass
            results.append({"id": s.id, "name_jp": getattr(s, "name_jp", None), "distance_m": dist})

        return Response({"results": results}, status=status.HTTP_200_OK)


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

        # BBOX（near=LAT,LNG & radius_km=R）— 軽量BBOX
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
                pass  # パラメータ不正は無視

        # 合成スコア：直近30日の訪問(×2.0) + popular_score(×0.5)
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


class ShrineViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Shrine.objects.all().prefetch_related("goriyaku_tags", "deities")
    permission_classes = [permissions.AllowAny]
    throttle_scope = "shrines"

    def get_serializer_class(self):
        if getattr(self, "action", None) in {"list", "nearest"}:
            return ShrineListSerializer
        return ShrineDetailSerializer

    def get_queryset(self):
        qs = self.queryset
        params = self.request.query_params
        kind = (params.get("kind") or "shrine").lower()
        if kind in ("shrine", "temple"):
            qs = qs.filter(kind=kind)
        elif kind != "all":
            qs = qs.filter(kind="shrine")
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
        ky_vals = [v for v in params.getlist("kyusei") if v]
        if ky_vals:
            qs = qs.filter(kyusei__in=ky_vals)
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
        qs = annotate_is_favorite(qs, self.request)
        if getattr(self, "action", None) == "retrieve":
            return self.queryset
        return qs.distinct()

    @action(
        detail=False, methods=["get"], url_path="nearest", permission_classes=[permissions.AllowAny]
    )
    @extend_schema(
        operation_id="shrines_nearest_list",
        summary="Nearest shrines",
        description="lat,lng と任意の q から距離順で神社を返す（配列）。",
        tags=["shrines"],
        parameters=[
            OpenApiParameter(
                name="lat", type=OpenApiTypes.FLOAT, location=OpenApiParameter.QUERY, required=True
            ),
            OpenApiParameter(
                name="lng", type=OpenApiTypes.FLOAT, location=OpenApiParameter.QUERY, required=True
            ),
            OpenApiParameter(
                name="q", type=OpenApiTypes.STR, location=OpenApiParameter.QUERY, required=False
            ),
            OpenApiParameter(
                name="limit", type=OpenApiTypes.INT, location=OpenApiParameter.QUERY, required=False
            ),
        ],
        responses={200: ShrineListSerializer(many=True)},
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
        qs = nearest_queryset(lng, lat)
        kind = (params.get("kind") or "shrine").lower()
        if kind in ("shrine", "temple"):
            qs = qs.filter(kind=kind)
        elif kind != "all":
            qs = qs.filter(kind="shrine")
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
        ky_vals = [v for v in params.getlist("kyusei") if v]
        if ky_vals:
            qs = qs.filter(kyusei__in=ky_vals)
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
        qs = annotate_is_favorite(qs, request)[:limit]
        data = ShrineListSerializer(qs, many=True, context={"request": request}).data
        return Response(data)
