import pytest
from django.urls import reverse

@pytest.mark.django_db
def test_places_find_lite_requires_input(client):
    url = reverse("temples:places-find-lite")
    res = client.get(url)
    assert res.status_code == 400

@pytest.mark.django_db
def test_places_find_lite_ok(client, monkeypatch):
    from temples.services import places

    def fake_find_place(**kwargs):
        return {
            "candidates": [
                {
                    "place_id": "pid",
                    "name": "明治神宮",
                    "formatted_address": "東京都渋谷区",
                    "geometry": {"location": {"lat": 35.0, "lng": 139.0}},
                    "types": ["shinto_shrine"],
                }
            ]
        }

    monkeypatch.setattr(places, "find_place", fake_find_place)

    url = reverse("temples:places-find-lite")
    res = client.get(url, {"input": "明治神宮"})
    assert res.status_code == 200

    body = res.json()
    assert "results" in body
    assert body["results"][0]["place_id"] == "pid"
