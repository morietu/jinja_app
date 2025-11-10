# backend/temples/tests/test_nearest_extra.py
import pytest
from temples.models import Shrine
from temples.queries import nearest_shrines


@pytest.mark.django_db
def test_nearest_with_radius_filters():
    # 基点(135.0000, 35.0000) から ≈2km 東にずらすと 1km 半径から外れる
    s = Shrine.objects.create(name_jp="X", address="dummy", latitude=35.0, longitude=135.02)

    # 半径3km内 → ヒット
    qs_in = nearest_shrines(135.0, 35.0, limit=10, radius_m=3_000)
    assert list(qs_in.values_list("id", flat=True)) == [s.id]

    # 半径1km内 → ヒットしない
    qs_out = nearest_shrines(135.0, 35.0, limit=10, radius_m=1_000)
    assert list(qs_out) == []
