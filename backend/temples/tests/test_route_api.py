import pytest
from rest_framework.test import APIClient


@pytest.fixture
def api_client():
    return APIClient()


def test_route_api_ok(api_client):
    payload = {
        "mode": "walking",
        "origin": {"lat": 35.68, "lng": 139.76},
        "destinations": [{"lat": 35.67, "lng": 139.71}, {"lat": 35.66, "lng": 139.70}],
    }
    res = api_client.post("/api/route/", data=payload, format="json")
    assert res.status_code == 200, res.content
    body = res.json()
    assert body["mode"] == "walking"
    assert len(body["legs"]) == 2
    assert body["distance_m_total"] > 0
    assert body["duration_s_total"] > 0
    assert body["provider"] in {"dummy", "mapbox", "google"}


def test_route_api_requires_destinations(api_client):
    payload = {
        "mode": "walking",
        "origin": {"lat": 35.68, "lng": 139.76},
        "destinations": [],
    }
    res = api_client.post("/api/route/", data=payload, format="json")
    assert res.status_code == 400  # allow_empty=False によりバリデーションエラー


def test_route_api_max_destinations(api_client):
    # 6件（上限5を超える）で 400
    payload = {
        "mode": "walking",
        "origin": {"lat": 35.68, "lng": 139.76},
        "destinations": [{"lat": 35.67 + i * 0.001, "lng": 139.71} for i in range(6)],
    }
    res = api_client.post("/api/route/", data=payload, format="json")
    assert res.status_code == 400


@pytest.mark.parametrize(
    "origin",
    [
        {"lat": 100.0, "lng": 139.76},  # lat 範囲外
        {"lat": 35.68, "lng": 200.0},  # lng 範囲外
    ],
)
def test_route_api_latlng_range_validation(api_client, origin):
    payload = {
        "mode": "walking",
        "origin": origin,
        "destinations": [{"lat": 35.67, "lng": 139.71}],
    }
    res = api_client.post("/api/route/", data=payload, format="json")
    assert res.status_code == 400
