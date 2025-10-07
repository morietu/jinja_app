import pytest
from django.contrib.gis.geos import Point
from django.urls import reverse
from temples.tests.factories import make_shrine

pytestmark = pytest.mark.postgis  # PostGIS前提

# 東京駅(35.6812, 139.7671) からの距離イメージで配置
TOKYO_EKI = (35.6812, 139.7671)
NEAR_BY = [
    ("A_100m", 35.6812 + 0.0009, 139.7671),  # 約100m北
    ("B_300m", 35.6812 + 0.0027, 139.7671),  # 約300m北
    ("C_600m", 35.6812 + 0.0054, 139.7671),  # 約600m北
]
FAR_AWAY = [
    ("Z_2km", 35.6812 + 0.018, 139.7671),  # ~2km
]


@pytest.fixture(autouse=True)
def _data(db):
    for name, lat, lng in NEAR_BY + FAR_AWAY:
        make_shrine(name, lat, lng)


def url():
    # shrine_project/urls.py で `path("api/", include(("temples.urls","temples"), namespace="temples"))`
    # temples/urls.py で `path("shrines/nearby", ShrineNearbyView.as_view(), name="nearby")`
    return reverse("temples:nearby")


def test_missing_params_returns_400(client):
    r = client.get(url())
    assert r.status_code == 400


def test_basic_within_radius_and_ordered(client):
    lat, lng = TOKYO_EKI
    r = client.get(url(), {"lat": lat, "lng": lng, "radius": 1000, "limit": 10})
    assert r.status_code == 200
    body = r.json()
    names = [x["name_jp"] for x in body["results"]]

    # 1km 以内は A/B/C の3件、かつ距離昇順
    assert names == ["A_100m", "B_300m", "C_600m"]
    dists = [x["distance_m"] for x in body["results"]]
    assert dists == sorted(dists)


def test_radius_filters_out_far(client):
    lat, lng = TOKYO_EKI
    r = client.get(url(), {"lat": lat, "lng": lng, "radius": 500, "limit": 10})
    assert r.status_code == 200
    names = [x["name_jp"] for x in r.json()["results"]]
    # 500mだと A_100m/B_300m は入るが C_600m, Z_2km は外れる
    assert names == ["A_100m", "B_300m"]


def test_limit_applied_after_sorting(client):
    lat, lng = TOKYO_EKI
    r = client.get(url(), {"lat": lat, "lng": lng, "radius": 2000, "limit": 2})
    assert r.status_code == 200
    names = [x["name_jp"] for x in r.json()["results"]]
    assert names == ["A_100m", "B_300m"]
    assert len(names) == 2


def test_lon_alias_works(client):
    lat, lng = TOKYO_EKI
    r = client.get(url(), {"lat": lat, "lon": lng, "radius": 1000, "limit": 10})
    assert r.status_code == 200
    assert len(r.json()["results"]) == 3
