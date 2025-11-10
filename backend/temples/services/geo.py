# -*- coding: utf-8 -*-
from django.conf import settings
from django.db.models.expressions import RawSQL
from temples.models import Shrine

EARTH_RADIUS_M = 6371000.0


def nearest_shrines(lon: float, lat: float, limit: int = 10):
    use_real_gis = bool(getattr(settings, "USE_GIS", False)) and not bool(
        getattr(settings, "DISABLE_GIS_FOR_TESTS", False)
    )

    qs = Shrine.objects.all()

    if use_real_gis:
        # 既存のGISルート（例：<->, ST_DistanceSphere）
        return (
            qs.filter(location__isnull=False)
            .extra(
                select={"dist_m": "ST_DistanceSphere(location, ST_SetSRID(ST_Point(%s,%s), 4326))"},
                select_params=[lon, lat],
            )
            .order_by("dist_m")[:limit]
        )

    # --- NoGIS: latitude/longitude からハバースイン距離(m)を計算 ---
    haversine_sql = f"""
        {2 * EARTH_RADIUS_M} * ASIN(
            SQRT(
                POWER(SIN(RADIANS((latitude - %s)/2)), 2) +
                COS(RADIANS(latitude)) * COS(RADIANS(%s)) *
                POWER(SIN(RADIANS((longitude - %s)/2)), 2)
            )
        )
    """
    return (
        qs.filter(latitude__isnull=False, longitude__isnull=False)
        .annotate(dist_m=RawSQL(haversine_sql, params=[lat, lat, lon]))
        .order_by("dist_m")[:limit]
    )
