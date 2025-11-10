# -*- coding: utf-8 -*-
import math

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

__all__ = ["nearest_queryset", "nearest_shrines"]


def nearest_shrines(*, lon: float, lat: float, limit: int = 20, radius_m: int | None = None):
    """
    近傍神社を距離順で返す。

    - PostGIS あり: ST_DWithin + KNN(<->) + ST_DistanceSphere
    - PostGIS なし(PostgreSQL): ハバースイン距離で annotate→filter→order
    - SQLite 等: Python 側で距離計算
    """
    use_real_gis = _use_real_gis()

    # ---------- PostGIS あり ----------
    if use_real_gis:
        point_sql = "ST_SetSRID(ST_Point(%s,%s), 4326)"
        point_params = (lon, lat)

        qs = Shrine.objects.filter(location__isnull=False)

        if radius_m is not None:
            qs = qs.extra(
                where=[f"ST_DWithin(location::geography, {point_sql}::geography, %s)"],
                params=point_params + (float(radius_m),),
            )

        qs = (
            qs.annotate(
                _knn=RawSQL(f"location <-> {point_sql}", point_params),
                distance_m=RawSQL(f"ST_DistanceSphere(location, {point_sql})", point_params),
            )
            .order_by("_knn", "distance_m")
        )
        return qs[:limit]

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

    distances: list[tuple[int, float]] = []
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
