# temples/queries.py
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
    return bool(getattr(settings, "USE_GIS", False)) and not bool(
        getattr(settings, "DISABLE_GIS_FOR_TESTS", False)
    )


def nearest_queryset(lon: float, lat: float):
    qs = Shrine.objects.all()
    if _use_real_gis():
        point_sql = "ST_SetSRID(ST_Point(%s,%s), 4326)"
        params = [lon, lat]
        return (
            qs.filter(location__isnull=False)
            .annotate(
                distance_m=RawSQL(f"ST_DistanceSphere(location, {point_sql})", params),
                _knn=RawSQL(f"location <-> {point_sql}", params),
            )
            .order_by("_knn", "distance_m")
        )
    if connection.vendor == "postgresql":
        haversine_sql = f"""{2*EARTH_RADIUS_M} * ASIN(
            SQRT(
                POWER(SIN(RADIANS((latitude - %s)/2)), 2) +
                COS(RADIANS(latitude)) * COS(RADIANS(%s)) *
                POWER(SIN(RADIANS((longitude - %s)/2)), 2)
            )
        )"""
        return (
            qs.filter(latitude__isnull=False, longitude__isnull=False)
            .annotate(distance_m=RawSQL(haversine_sql, params=[lat, lat, lon]))
            .order_by("distance_m")
        )
    return Shrine.objects.none()


def nearest_shrines(lon: float, lat: float, limit: int = 20, radius_m: int | None = None):
    if _use_real_gis():
        point_sql = "ST_SetSRID(ST_Point(%s,%s), 4326)"
        params = (lon, lat)
        qs = Shrine.objects.filter(location__isnull=False).annotate(
            _knn=RawSQL(f"location <-> {point_sql}", params),
            d_m=RawSQL(f"ST_DistanceSphere(location, {point_sql})", params),
            distance_m=RawSQL(f"ST_DistanceSphere(location, {point_sql})", params),
        )
        if radius_m is not None:
            qs = qs.filter(d_m__lte=float(radius_m))
        return qs.order_by("_knn", "d_m")[:limit]

    if connection.vendor == "postgresql":
        haversine_sql = f"""{2*EARTH_RADIUS_M} * ASIN(
            SQRT(
                POWER(SIN(RADIANS((latitude - %s)/2)), 2) +
                COS(RADIANS(latitude)) * COS(RADIANS(%s)) *
                POWER(SIN(RADIANS((longitude - %s)/2)), 2)
            )
        )"""
        qs = Shrine.objects.filter(latitude__isnull=False, longitude__isnull=False).annotate(
            d_m=RawSQL(haversine_sql, params=[lat, lat, lon])
        )
        if radius_m is not None:
            qs = qs.filter(d_m__lte=float(radius_m))
        return qs.order_by("d_m")[:limit]

    # SQLite 等: Python フォールバック
    base_qs = Shrine.objects.filter(location__isnull=False)

    def haversine_m(lon1, lat1, lon2, lat2):
        R = EARTH_RADIUS_M
        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlambda = math.radians(lon2 - lon1)
        a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
        return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    distances: List[Tuple[int, float]] = []
    for obj in base_qs:
        ll = to_lon_lat(obj.location)
        if not ll:
            continue
        d = haversine_m(lon, lat, ll[0], ll[1])
        if radius_m is not None and d > float(radius_m):
            continue
        distances.append((obj.id, d))

    distances.sort(key=lambda t: t[1])
    distances = distances[:limit]
    if not distances:
        return base_qs.none()

    ids = [pk for pk, _ in distances]
    when_order = [When(id=pk, then=Value(i)) for i, pk in enumerate(ids)]
    when_dist = [When(id=pk, then=Value(dist)) for pk, dist in distances]
    return (
        Shrine.objects.filter(id__in=ids)
        .annotate(ordering=Case(*when_order, output_field=IntegerField()))
        .annotate(distance_m=Case(*when_dist, output_field=FloatField()))
        .order_by("ordering")
    )


__all__ = ["nearest_queryset", "nearest_shrines"]
