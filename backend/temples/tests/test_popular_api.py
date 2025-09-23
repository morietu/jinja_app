import pytest
from django.urls import reverse
from temples.models import Shrine


@pytest.mark.django_db
def test_popular_ordering(api_client):
    a = Shrine.objects.create(name_jp="A", popular_score=10.0, latitude=35.0, longitude=135.0)
    b = Shrine.objects.create(name_jp="B", popular_score=30.0, latitude=35.0, longitude=135.0)
    res = api_client.get(reverse("temples:popular-shrines"), {"limit": 10})
    assert res.status_code == 200
    names = [it["name_jp"] for it in res.json()["items"]]
    assert names[:2] == ["B", "A"]


@pytest.mark.django_db
def test_near_filter_bbox(api_client):
    near_lat, near_lng = 35.68, 139.76
    inside = Shrine.objects.create(
        name_jp="Near", popular_score=1.0, latitude=35.681, longitude=139.761
    )
    far = Shrine.objects.create(name_jp="Far", popular_score=999.0, latitude=34.7, longitude=135.5)
    res = api_client.get(
        reverse("temples:popular-shrines"),
        {"near": f"{near_lat},{near_lng}", "radius_km": 5, "limit": 10},
    )
    assert res.status_code == 200
    names = [it["name_jp"] for it in res.json()["items"]]
    assert "Near" in names and "Far" not in names
