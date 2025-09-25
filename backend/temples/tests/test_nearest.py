# temples/tests/test_nearest.py
import pytest
from django.contrib.gis.geos import Point
from temples.models import Shrine
from temples.queries import nearest_shrines

pytestmark = pytest.mark.django_db


def test_nearest_shrines_returns_ordered_results():
    s = Shrine.objects.create(
        name_jp="テスト神社",
        address="東京都千代田区丸の内1-9-1",
        latitude=35.6812,
        longitude=139.7671,
    )
    s.location = Point(s.longitude, s.latitude, srid=4326)  # (lon, lat)
    s.save(update_fields=["location"])

    qs = nearest_shrines(139.7671, 35.6812, limit=3)
    assert list(qs.values_list("name_jp", flat=True))[0] == "テスト神社"
    assert float(qs[0].d_m) < 10  # ほぼゼロ距離
