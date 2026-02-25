import pytest

from temples.models import PlaceRef
from temples.services.places_sync import sync_nearby_seed


@pytest.mark.django_db
def test_sync_nearby_seed_skips_items_missing_place_id(monkeypatch):
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
                    "name": "壊れ神社",  # place_id なし
                    "vicinity": "東京都どこか",
                    "geometry": {"location": {"lat": 35.05, "lng": 139.05}},
                },
                {
                    "place_id": "pid_2",
                    "name": "神社B",
                    "vicinity": "東京都どこか",
                    "geometry": {"location": {"lat": 35.1, "lng": 139.1}},
                },
            ]
        }

    # ✅ sync_nearby_seed が実際に呼ぶ窓口を差し替える
    monkeypatch.setattr(
        "temples.services.places_sync._google_places_nearby_search",
        lambda **kw: fake_nearby_search(**kw),
    )

    out = sync_nearby_seed(
        lat=35.0, lng=139.0, radius_m=2000, keyword="神社", limit=20, dry_run=False
    )

    assert out["fetched"] == 3
    assert out["upserted"] == 2
    assert any(e.get("type") == "invalid_item" for e in out["errors"]), out["errors"]

    assert PlaceRef.objects.filter(place_id="pid_1").exists()
    assert PlaceRef.objects.filter(place_id="pid_2").exists()


@pytest.mark.django_db
def test_sync_nearby_seed_requests_used_is_0_when_cached(monkeypatch):
    # cached=True なら外部I/Oを使ってない契約
    monkeypatch.setattr(
        "temples.services.places_sync._google_places_nearby_search",
        lambda **kw: {
            "cached": True,
            "results": [
                {
                    "place_id": "pid_1",
                    "name": "神社A",
                    "vicinity": "東京都なんとか",
                    "geometry": {"location": {"lat": 35.0, "lng": 139.0}},
                }
            ],
        },
    )

    out = sync_nearby_seed(
        lat=35.0, lng=139.0, radius_m=2000, keyword="神社", limit=20, dry_run=True
    )

    assert out["requests_used"] == 0
    assert out["fetched"] == 1


@pytest.mark.django_db
def test_sync_nearby_seed_requests_used_is_1_when_not_cached(monkeypatch):
    # cached が無い（または True ではない）なら外部I/Oを使った契約
    monkeypatch.setattr(
        "temples.services.places_sync._google_places_nearby_search",
        lambda **kw: {
            "results": [
                {
                    "place_id": "pid_1",
                    "name": "神社A",
                    "vicinity": "東京都なんとか",
                    "geometry": {"location": {"lat": 35.0, "lng": 139.0}},
                }
            ],
            # "cached": False,  # 付けても良いけど、契約としては不要（揺れの元）
        },
    )

    out = sync_nearby_seed(
        lat=35.0, lng=139.0, radius_m=2000, keyword="神社", limit=20, dry_run=True
    )

    assert out["requests_used"] == 1
    assert out["fetched"] == 1
