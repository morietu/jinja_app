# backend/temples/queries.py
# -*- coding: utf-8 -*-
import math
from typing import List, Tuple

from django.conf import settings
from django.db import connection
from django.db.models import Case, FloatField, IntegerField, Value, When
from django.db.models.expressions import RawSQL

from .geo_utils import to_lon_lat
from .models import Shrine

EARTH_RADIUS_M = 6371000.0

def _use_real_gis() -> bool:
    # PostGIS を使うかの最終判定（テスト時の強制無効も考慮）
    return bool(getattr(settings, "USE_GIS", False)) and not bool(
        getattr(settings, "DISABLE_GIS_FOR_TESTS", False)
    )

__all__ = ["nearest_queryset", "nearest_shrines"]

def nearest_queryset(lon: float, lat: float):
    """
    共通の近傍 QuerySet（距離 d_m を注釈、必要なら _knn も注釈）。
    ここではフィルタ/limitはしない。呼び出し側で行う。
    """
    # ---------- PostGIS ----------
    if _use_real_gis():
        point_sql = "ST_SetSRID(ST_Point(%s,%s), 4326)"
        point_params = (lon, lat)
        return Shrine.objects.filter(location__isnull=False).annotate(
            _knn=RawSQL(f"location <-> {point_sql}", point_params),
            d_m=RawSQL(f"ST_DistanceSphere(location, {point_sql})", point_params),
            # 互換のために distance_m も付与
            distance_m=RawSQL(f"ST_DistanceSphere(location, {point_sql})", point_params),
        )

    # ---------- NoGIS(PostgreSQL): lat/lon カラムでハバースイン ----------
    if connection.vendor == "postgresql":
        haversine_sql = f"""
            {2*EARTH_RADIUS_M} * ASIN(
                SQRT(
                    POWER(SIN(RADIANS((%s - lat)/2)), 2) +
                    COS(RADIANS(lat)) * COS(RADIANS(%s)) *
                    POWER(SIN(RADIANS((%s - lon)/2)), 2)
                )
            )
        """
        params = (lat, lat, lon)
        # d_m を注釈。KNN相当のソートキーとして _knn には d_m を再利用
        return Shrine.objects.filter(lat__isnull=False, lon__isnull=False).extra(
            select={"d_m": haversine_sql, "_knn": haversine_sql},
            select_params=params,
        )

    # ---------- SQLite 等: DBでは距離計算しない ----------
    return Shrine.objects.none()

def nearest_shrines(lon: float, lat: float, limit: int = 20, radius_m: int | None = None):
    """
    近傍神社を距離順で返す。
    - PostGIS: KNN(<->) + ST_DistanceSphere を d_m として注釈し、d_m で絞り込み/並び替え
    - NoGIS(PostgreSQL): ハバースイン距離を d_m として注釈し、d_m で絞り込み/並び替え
    - SQLite 等: Python側フォールバック
    """
    # SQLite 等は Python フォールバック
    if connection.vendor == "sqlite":
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

    # PostGIS / NoGIS(PostgreSQL) は DB 側で d_m 注釈済み
    qs = nearest_queryset(lon, lat)
    if radius_m is not None:
        qs = qs.filter(d_m__lte=float(radius_m))
    return qs.order_by("_knn", "d_m")[:limit]
