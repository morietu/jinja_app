import types
import pytest
from django.urls import reverse
from temples.services.concierge import ConciergeService

@pytest.fixture(autouse=True)
def mock_places(monkeypatch):
    orig_init = ConciergeService.__init__
    def patched_init(self):
        orig_init(self)
        def mock_find_place(**kw): return {"results": [{
            "place_id": "PID_MAIN",
            "name": "浅草神社",
            "formatted_address": "東京都台東区浅草2-3-1",
            "geometry": {"location": {"lat": 35.7151665, "lng": 139.7974389}},
        }]}
        def mock_nearby_search(**kw): return {"results": [{
            "place_id": "ALT_1",
            "name": "浅草寺",
            "vicinity": "浅草",
            "geometry": {"location": {"lat": 35.714, "lng": 139.796}},
            "rating": 4.7, "user_ratings_total": 10000, "distance_m": 300,
        }]}
        self.places.find_place = types.MethodType(lambda _self, **kw: mock_find_place(**kw), self.places)
        self.places.nearby_search = types.MethodType(lambda _self, **kw: mock_nearby_search(**kw), self.places)
    monkeypatch.setattr(ConciergeService, "__init__", patched_init)
    return True

@pytest.mark.django_db
def test_post_concierge_plan(client):
    url = reverse("concierge-plan")
    res = client.post(url, data={
        "query": "浅草神社",
        "language": "ja",
        "locationbias": "circle:1500@35.715,139.797",
        "transportation": "walk",
    }, content_type="application/json")
    assert res.status_code == 200, res.content
    body = res.json()
    assert body["main"]["place_id"] == "PID_MAIN"
    assert body["route_hints"]["mode"] == "walk"
