import pytest
from django.core.cache import cache

@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()



@pytest.mark.parametrize("status", ["OVER_QUERY_LIMIT", "REQUEST_DENIED", "INVALID_REQUEST"])
def test_nearby_does_not_cache_error_status(monkeypatch, status):
    from temples.services import places, google_places

    cache.clear()
    calls = {"n": 0}

    def fake_nearby_search(**kwargs):
        calls["n"] += 1
        return {"status": status, "results": [{"place_id": "dummy"}]}

    monkeypatch.setattr(google_places, "nearby_search", fake_nearby_search)

    params = {
        "lat": 35.0,
        "lng": 139.0,
        "radius": 1000,
        "keyword": "神社",
        "language": "ja",
    }

    d1 = places.places_nearby_search(params)
    d2 = places.places_nearby_search(params)

    assert d1["status"] == status
    assert d2["status"] == status
    assert calls["n"] == 2  # キャッシュされない
    


def test_nearby_caches_ok(monkeypatch):
    from temples.services import places, google_places

    cache.clear()
    calls = {"n": 0}

    def fake_nearby_search(**kwargs):
        calls["n"] += 1
        return {"status": "OK", "results": [{"place_id": "dummy"}]}

    monkeypatch.setattr(google_places, "nearby_search", fake_nearby_search)

    params = {
        "lat": 35.0,
        "lng": 139.0,
        "radius": 1000,
        "keyword": "神社",
        "language": "ja",
    }

    d1 = places.places_nearby_search(params)
    d2 = places.places_nearby_search(params)

    assert d1["status"] == "OK"
    assert d2["status"] == "OK"
    assert calls["n"] == 1  # OKはキャッシュ
