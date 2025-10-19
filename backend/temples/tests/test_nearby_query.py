import pytest
from temples.queries import nearest_shrines
from temples.tests.factories import make_shrine

pytestmark = pytest.mark.postgis

TOKYO_EKI = (35.6812, 139.7671)


@pytest.fixture(autouse=True)
def _data(db):
    make_shrine("A", TOKYO_EKI[0] + 0.0009, TOKYO_EKI[1])
    make_shrine("B", TOKYO_EKI[0] + 0.0027, TOKYO_EKI[1])
    make_shrine("C", TOKYO_EKI[0] + 0.0054, TOKYO_EKI[1])
    make_shrine("Z", TOKYO_EKI[0] + 0.0180, TOKYO_EKI[1])


def test_knn_order_and_distance_column(db):
    lat, lng = TOKYO_EKI
    qs = nearest_shrines(lon=lng, lat=lat, limit=10, radius_m=2000)  # 2km
    rows = list(qs.values_list("name_jp", "distance_m"))
    names = [n for n, _ in rows]
    assert names == ["A", "B", "C"]  # Zは2km外
    # 距離列が付与され float 変換できる
    for _, d in rows:
        assert float(d) >= 0.0


def test_limit_applied(db):
    lat, lng = TOKYO_EKI
    qs = nearest_shrines(lon=lng, lat=lat, limit=2, radius_m=None)  # KNNのみ
    names = [n for (n,) in qs.values_list("name_jp")]
    assert len(names) == 2
