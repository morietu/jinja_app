# backend/temples/tests/test_ranking_api.py
from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from temples.models import Shrine, Visit


@pytest.fixture
def api_client():
    return APIClient()


@pytest.mark.django_db
def test_scoring_weights_order(api_client):
    User = get_user_model()
    u = User.objects.create_user(username="u1", password="p")

    # C: visits=2 → 4pt
    c = Shrine.objects.create(name_jp="C", popular_score=0.0, latitude=35.0, longitude=135.0)
    for _ in range(2):
        Visit.objects.create(shrine=c, user=u, visited_at=timezone.now())

    # B: popular_score=5 → 2.5pt
    b = Shrine.objects.create(name_jp="B", popular_score=5.0, latitude=35.0, longitude=135.0)

    # A: visits=1 → 2pt
    a = Shrine.objects.create(name_jp="A", popular_score=0.0, latitude=35.0, longitude=135.0)
    Visit.objects.create(shrine=a, user=u, visited_at=timezone.now())

    res = api_client.get(reverse("temples:popular-shrines"), {"limit": 10})
    assert res.status_code == 200
    names = [it["name_jp"] for it in res.json()["items"]]
    assert names[:3] == ["C", "B", "A"]


@pytest.mark.django_db
def test_30day_window_on_visits(api_client):
    User = get_user_model()
    u = User.objects.create_user(username="u2", password="p")

    s = Shrine.objects.create(name_jp="S", popular_score=0.0, latitude=35.0, longitude=135.0)
    # 31日前 → カウントされない
    Visit.objects.create(shrine=s, user=u, visited_at=timezone.now() - timedelta(days=31))
    # 今日 → カウントされる（2pt）
    Visit.objects.create(shrine=s, user=u, visited_at=timezone.now())

    t = Shrine.objects.create(name_jp="T", popular_score=0.0, latitude=35.1, longitude=135.1)

    res = api_client.get(reverse("temples:popular-shrines"), {"limit": 10})
    assert res.status_code == 200
    names = [it["name_jp"] for it in res.json()["items"]]
    assert names[0] == "S"


@pytest.mark.django_db
def test_bbox_filter_keeps_only_near(api_client):
    """
    near & radius_km を指定したら近傍だけ返る（Far が除外される）。
    """
    near_lat, near_lng = 35.68, 139.76

    inside = Shrine.objects.create(
        name_jp="Near", popular_score=1.0, latitude=35.681, longitude=139.761
    )
    # スコアの影響を避けるため、Far にも適当な popular_score を入れておくが
    # BBOX外なので除外されるはず
    far = Shrine.objects.create(name_jp="Far", popular_score=999.0, latitude=34.7, longitude=135.5)

    res = api_client.get(
        reverse("temples:popular-shrines"),
        {"near": f"{near_lat},{near_lng}", "radius_km": 5, "limit": 10},
    )
    assert res.status_code == 200
    names = [it["name_jp"] for it in res.json()["items"]]
    assert "Near" in names and "Far" not in names
