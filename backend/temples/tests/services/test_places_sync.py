import pytest

from temples.models import PlaceRef
from temples.services.places_sync import sync_nearby_seed


def _patch_google_places(monkeypatch, payload: dict):
    # ✅ sync_nearby_seed が実際に呼ぶ唯一の窓口を差し替える
    monkeypatch.setattr(
        "temples.services.places_sync._google_places_nearby_search",
        lambda **kw: payload,
    )


def _place(pid: str, name: str):
    return {
        "place_id": pid,
        "name": name,
        "vicinity": "東京都どこか",
        "geometry": {"location": {"lat": 35.0, "lng": 139.0}},
    }


@pytest.mark.django_db
def test_sync_nearby_seed_skips_items_missing_place_id(monkeypatch):
    payload = {
        "results": [
            _place("pid_1", "神社A"),
            {
                "name": "壊れ神社",  # place_id なし
                "vicinity": "東京都どこか",
                "geometry": {"location": {"lat": 35.05, "lng": 139.05}},
            },
            _place("pid_2", "神社B"),
        ]
    }
    _patch_google_places(monkeypatch, payload)

    out = sync_nearby_seed(
        lat=35.0, lng=139.0, radius_m=2000, keyword="神社", limit=20, dry_run=False
    )

    assert out["fetched"] == 3
    assert out["upserted"] == 2
    assert any(e.get("type") == "invalid_item" for e in out["errors"]), out["errors"]

    assert PlaceRef.objects.filter(place_id="pid_1").exists()
    assert PlaceRef.objects.filter(place_id="pid_2").exists()


@pytest.mark.django_db
@pytest.mark.parametrize(
    "payload, expected_requests_used, expected_fetched",
    [
        ({"cached": True, "results": [_place("pid_1", "神社A")]}, 0, 1),
        ({"cached": False, "results": []}, 1, 0),
        ({"results": []}, 1, 0),  # cached キー無し
        ({"cached": "true", "results": []}, 1, 0),  # cached が bool 以外
    ],
)
def test_sync_nearby_seed_requests_used_contract(monkeypatch, payload, expected_requests_used, expected_fetched):
    _patch_google_places(monkeypatch, payload)

    out = sync_nearby_seed(
        lat=35.0, lng=139.0, radius_m=2000, keyword="神社", limit=20, dry_run=True
    )

    assert out["requests_used"] == expected_requests_used
    assert out["fetched"] == expected_fetched
