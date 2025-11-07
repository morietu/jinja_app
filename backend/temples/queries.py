# temples/queries.py
import math

from django.db import connection
from django.db.models import Case, FloatField, IntegerField, Value, When
from django.db.models.expressions import RawSQL
from .geo_utils import to_lon_lat
from .models import Shrine


def nearest_shrines(lon: float, lat: float, limit: int = 20, radius_m: int | None = None):
    point_sql = "ST_SetSRID(ST_Point(%s,%s), 4326)"
    point_params = (lon, lat)

    if connection.vendor == "postgresql":
        qs = Shrine.objects.filter(location__isnull=False)

        if radius_m is not None:
            qs = qs.extra(
                where=[f"ST_DWithin(location::geography, {point_sql}::geography, %s)"],
                params=point_params + (radius_m,),
            )

        qs = qs.annotate(
            distance_m=RawSQL(f"ST_DistanceSphere(location, {point_sql})", point_params),
            d_m=RawSQL(f"ST_DistanceSphere(location, {point_sql})", point_params),
            _knn=RawSQL(f"location <-> {point_sql}", point_params),
        ).order_by("_knn", "d_m")

        return qs[:limit]

    # --- SQLite 等のフォールバック ---
    base_qs = Shrine.objects.filter(location__isnull=False)

    def haversine_m(lon1, lat1, lon2, lat2):
        R = 6371000.0
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlambda = math.radians(lon2 - lon1)
        a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c

    distances: list[tuple[int, float]] = []
    for obj in base_qs:
        geom = obj.location
        if geom is None:
            continue
        obj_lon, obj_lat = to_lon_lat(geom)
        if obj_lon is None or obj_lat is None:
            continue
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

    qs = (
        Shrine.objects.filter(id__in=ids_ordered)
        .annotate(ordering=Case(*when_order, output_field=IntegerField()))
        .annotate(d_m=Case(*when_dist, output_field=FloatField()))
        .order_by("ordering")
    )
    return qs
