def test_geocode_search_smoke(client, settings, requests_mock):
    settings.NOMINATIM_BASE = "https://nominatim.openstreetmap.org"
    settings.NOMINATIM_EMAIL = "dev@example.com"
    url = f"{settings.NOMINATIM_BASE}/search"
    requests_mock.get(
        url,
        json=[
            {
                "place_id": "1",
                "display_name": "明治神宮, 東京",
                "lat": "35.6764",
                "lon": "139.6993",
                "class": "amenity",
                "type": "place_of_worship",
                "address": {"city": "渋谷区"},
            }
        ],
        status_code=200,
        additional_matcher=lambda r: "q=" in r.url and "format=jsonv2" in r.url,
    )
    resp = client.get("/api/geocode/search/?q=明治神宮&limit=1&lang=ja")
    assert resp.status_code == 200
    js = resp.json()
    assert js["items"][0]["name"].startswith("明治神宮")
    assert js["provider"] in ("nominatim", "throttled")


def test_geocode_reverse_smoke(client, settings, requests_mock):
    settings.NOMINATIM_BASE = "https://nominatim.openstreetmap.org"
    settings.NOMINATIM_EMAIL = "dev@example.com"
    url = f"{settings.NOMINATIM_BASE}/reverse"
    requests_mock.get(
        url,
        json={
            "place_id": "2",
            "display_name": "浅草神社",
            "lat": "35.7148",
            "lon": "139.7967",
            "address": {"city": "台東区"},
        },
        status_code=200,
        additional_matcher=lambda r: "format=jsonv2" in r.url,
    )
    resp = client.get("/api/geocode/reverse/?lat=35.7148&lng=139.7967&lang=ja")
    assert resp.status_code == 200
    js = resp.json()
    assert js["item"]["name"] == "浅草神社"
