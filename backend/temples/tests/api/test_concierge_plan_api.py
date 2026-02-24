import json
import types

import pytest
from django.urls import reverse
from temples.services.concierge import ConciergeService

def assert_400_field_errors(res, *, must_have=None):
    assert res.status_code == 400, res.content
    body = res.json()
    assert isinstance(body, dict)
    # field -> list[str] 形式であること（DRF標準）
    for k, v in body.items():
        assert isinstance(k, str)
        assert isinstance(v, list), (k, v)
        assert all(isinstance(x, str) for x in v), (k, v)

    if must_have:
        for key in must_have:
            assert key in body, body
            assert body[key], body

@pytest.fixture(autouse=True)
def mock_places(monkeypatch):
    orig_init = ConciergeService.__init__

    def patched_init(self):
        orig_init(self)

        def mock_find_place(**kw):
            return {
                "results": [
                    {
                        "place_id": "PID_MAIN",
                        "name": "浅草神社",
                        "formatted_address": "東京都台東区浅草2-3-1",
                        "geometry": {"location": {"lat": 35.7151665, "lng": 139.7974389}},
                    }
                ]
            }

        def mock_nearby_search(**kw):
            return {
                "results": [
                    {
                        "place_id": "ALT_1",
                        "name": "浅草寺",
                        "vicinity": "浅草",
                        "geometry": {"location": {"lat": 35.714, "lng": 139.796}},
                        "rating": 4.7,
                        "user_ratings_total": 10000,
                        "distance_m": 300,
                    }
                ]
            }

        self.places.find_place = types.MethodType(
            lambda _self, **kw: mock_find_place(**kw), self.places
        )
        self.places.nearby_search = types.MethodType(
            lambda _self, **kw: mock_nearby_search(**kw), self.places
        )

    monkeypatch.setattr(ConciergeService, "__init__", patched_init)
    return True


@pytest.mark.django_db
def test_post_concierge_plan(client):
    url = reverse("concierge-plan")
    res = client.post(
        url,
        data={
            "query": "浅草神社",
            "language": "ja",
            "locationbias": "circle:1500@35.715,139.797",
            "lat": 35.715,
            "lng": 139.797,
            "transportation": "walk",
        },
        content_type="application/json",
    )
    assert res.status_code == 200, res.content
    body = res.json()
    assert body["main"]["place_id"] == "PID_MAIN"
    assert body["route_hints"]["mode"] == "walk"


@pytest.mark.django_db
def test_post_concierge_plan_missing_area_and_latlng_returns_400(client):
    url = reverse("concierge-plan")
    res = client.post(
        url,
        data={
            "query": "金運 神社",
            "radius_km": 5,
            "transportation": "walk",
        },
        content_type="application/json",
    )
    assert res.status_code == 400, res.content

@pytest.mark.django_db
def test_post_concierge_plan_locationbias_only_still_returns_400(client):
    url = reverse("concierge-plan")
    res = client.post(
        url,
        data={
            "query": "金運 神社",
            "radius_km": 5,
            "locationbias": "circle:5000@35.6812,139.7671",
            "transportation": "walk",
        },
        content_type="application/json",
    )
    assert res.status_code == 400, res.content

@pytest.mark.django_db
def test_post_concierge_plan_radius_only_returns_400(client):
    url = reverse("concierge-plan")
    res = client.post(
        url,
        data=json.dumps({
            "query": "金運 神社",
            "radius_km": 5,
            "transportation": "walk",
        }),
        content_type="application/json",
    )
    assert_400_field_errors(res, must_have=["location"])

@pytest.mark.django_db
def test_post_concierge_plan_area_only_returns_200(client, monkeypatch):
    calls = {"geocode": 0}

    def fake_get(url, params=None, timeout=None, **kw):
        if "geocode" in url:
            calls["geocode"] += 1

            class R:
                def json(self):
                    return {
                        "results": [
                            {"geometry": {"location": {"lat": 35.0, "lng": 139.0}}}
                        ]
                    }

            return R()

        raise AssertionError(f"Unexpected requests.get called: {url}")

    monkeypatch.setattr("temples.api_views_concierge.requests.get", fake_get)

    url = reverse("concierge-plan")
    res = client.post(
        url,
        data=json.dumps(
            {
                "query": "縁結び",
                "area": "東京駅",
                "transportation": "walk",
            }
        ),
        content_type="application/json",
    )

    assert res.status_code == 200, res.content
    body = res.json()
    assert "main" in body
    assert "route_hints" in body

@pytest.mark.django_db
def test_post_concierge_plan_latlng_only_returns_200(client):
    url = reverse("concierge-plan")
    res = client.post(
        url,
        data=json.dumps({
            "query": "縁結び",
            "lat": 35.0,
            "lng": 139.0,
            "transportation": "walk",
        }),
        content_type="application/json",
    )
    assert res.status_code == 200

@pytest.mark.django_db
def test_post_concierge_plan_missing_query_returns_400(client):
    url = reverse("concierge-plan")
    res = client.post(
        url,
        data={"area": "東京駅"},
        content_type="application/json",
    )
    assert_400_field_errors(res, must_have=["query"])

@pytest.mark.django_db
def test_post_concierge_plan_blank_query_returns_400(client):
    url = reverse("concierge-plan")
    res = client.post(
        url,
        data={"query": "   ", "area": "東京駅"},
        content_type="application/json",
    )
    assert_400_field_errors(res, must_have=["query"])
