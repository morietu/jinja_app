import os
import pytest
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db

need_key = pytest.mark.skipif(
    not os.environ.get("GOOGLE_PLACES_API_KEY"),
    reason="GOOGLE_PLACES_API_KEY is not set",
)


@need_key
def test_places_search_ok():
    c = APIClient()
    res = c.get("/api/places/search/", {"q": "明治神宮", "lat": "35.67", "lng": "139.70"})
    assert res.status_code == 200
    j = res.json()
    assert "status" in j and "results" in j


@need_key
def test_places_detail_ok():
    c = APIClient()
    s = c.get("/api/places/search/", {"q": "明治神宮", "lat": "35.67", "lng": "139.70"}).json()
    if not s.get("results"):
        pytest.skip("no results from search")
    pid = s["results"][0]["place_id"]
    d = c.get(f"/api/places/{pid}/")
    assert d.status_code == 200
    body = d.json()
    assert body["place_id"] == pid
    assert body["location"]["lat"] is not None and body["location"]["lng"] is not None
