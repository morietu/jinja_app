import pytest
from django.utils import timezone

from temples.models import PlaceRef
from temples.services.places_sync import sync_nearby_seed

@pytest.mark.django_db
def test_sync_nearby_seed_upserts_place_ref(monkeypatch):
    def fake_nearby_search(**kwargs):
        return {
            "results": [
                {
                    "place_id": "pid_1",
                    "name": "神社A",
                    "vicinity": "東京都なんとか",
                    "geometry": {"location": {"lat": 35.0, "lng": 139.0}},
                },
                {
                    "place_id": "pid_2",
                    "name": "神社B",
                    "vicinity": "東京都どこか",
                    "geometry": {"location": {"lat": 35.1, "lng": 139.1}},
                },
            ]
        }

    monkeypatch.setattr("temples.services.places.nearby_search", fake_nearby_search)

    out = sync_nearby_seed(
        lat=35.0, lng=139.0, radius_m=2000, keyword="神社", limit=20, dry_run=False
    )

    assert out["requests_used"] == 1
    assert out["fetched"] == 2
    assert out["upserted"] == 2
    assert out["errors"] == []

    pr = PlaceRef.objects.get(place_id="pid_1")
    assert pr.name == "神社A"
    assert pr.address != ""
    assert pr.synced_at is not None
