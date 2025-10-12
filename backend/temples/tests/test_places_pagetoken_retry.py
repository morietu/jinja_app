# backend/temples/tests/test_places_pagetoken_retry.py
import json
import responses
from temples.services.google_places import GooglePlacesClient


@responses.activate
def test_nearby_retry_on_invalid_request():
    base = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
    # 1発目: INVALID_REQUEST
    responses.add(responses.GET, base, json={"status": "INVALID_REQUEST"}, status=200)
    # 2発目: OK（空配列で十分）
    responses.add(
        responses.GET,
        base,
        json={"status": "OK", "results": [], "next_page_token": None},
        status=200,
    )
    c = GooglePlacesClient(api_key="DUMMY")
    data, token = c.nearby_search(location="35,139", radius=100)
    assert data["status"] == "OK"
    assert data["results"] == []
    assert token is None
