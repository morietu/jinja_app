# temples/queries.py
import math

from django.db import connection
from django.db.models import Case, FloatField, IntegerField, Value, When
from django.db.models.expressions import RawSQL

from .models import Shrine


def nearest_shrines(lon: float, lat: float, limit: int = 20, radius_m: int | None = None):
    # 参照点（SQL側では ST_SetSRID(ST_Point(%s,%s),4326) を使う）
    point_sql = "ST_SetSRID(ST_Point(%s,%s), 4326)"
    point_params = (lon, lat)

    # Use PostGIS-specific SQL when running against PostgreSQL
    if connection.vendor == "postgresql":
        qs = Shrine.objects.filter(location__isnull=False)

        # 半径フィルタ（地理座標は geodesic 距離で判定するため geography にキャスト）
        if radius_m is not None:
            qs = qs.extra(
                where=[f"ST_DWithin(location::geography, {point_sql}::geography, %s)"],
                params=point_params + (radius_m,),
            )

        # KNN で近い順（GiST index活用） + 実距離(m)を列として出す
        qs = qs.annotate(
            # 実距離（球面距離, m） -- 互換性のため d_m という短い別名も付与
            distance_m=RawSQL(
                f"ST_DistanceSphere(location, {point_sql})",
                point_params,
            ),
            d_m=RawSQL(
                f"ST_DistanceSphere(location, {point_sql})",
                point_params,
            ),
            # KNN用キー（geometry距離；近傍順の並び替え専用）
            _knn=RawSQL(
                f"location <-> {point_sql}",
                point_params,
            ),
        ).order_by(
            "_knn", "d_m"
        )  # 近傍 & メートルの僅差調整

        return qs[:limit]

    # Fallback for SQLite/Spatialite (or other non-PostGIS backends): compute distances in Python
    # and return a QuerySet ordered by distance with an annotated `d_m` field so tests can access it.
    base_qs = Shrine.objects.filter(location__isnull=False)

    # Compute haversine distance
    def haversine_m(lon1, lat1, lon2, lat2):
        # returns distance in meters
        R = 6371000.0
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlambda = math.radians(lon2 - lon1)
        a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c

    distances = []
    for obj in base_qs:
        geom = obj.location
        if geom is None:
            continue
        obj_lon, obj_lat = geom.x, geom.y
        d = haversine_m(lon, lat, obj_lon, obj_lat)
        if radius_m is not None and d > radius_m:
            continue
        distances.append((obj.id, d))

    # sort and limit
    distances.sort(key=lambda t: t[1])
    distances = distances[:limit]
    if not distances:
        return base_qs.none()

    ids_ordered = [t[0] for t in distances]
    # annotate distances and ordering so QuerySet preserves order and has d_m attribute
    when_order = [When(id=pk, then=Value(i)) for i, pk in enumerate(ids_ordered)]
    when_dist = [When(id=pk, then=Value(dist)) for pk, dist in distances]

    qs = (
        Shrine.objects.filter(id__in=ids_ordered)
        .annotate(ordering=Case(*when_order, output_field=IntegerField()))
        .annotate(
            d_m=Case(*when_dist, output_field=FloatField()),
        )
        .order_by("ordering")
    )

    return qs
