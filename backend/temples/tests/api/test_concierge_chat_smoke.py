import json
from django.urls import reverse

URL = "/api/concierge/chat/"

def test_chat_accepts_message(client):
    r = client.post(
        URL,
        data=json.dumps({"message": "テスト", "lat": 35.0, "lng": 139.0}),
        content_type="application/json",
    )
    assert r.status_code == 200
    assert "reply" in r.json()

def test_chat_accepts_query(client):
    r = client.post(
        URL,
        data=json.dumps({"query": "テスト", "lat": "35.0", "lng": "139.0"}),
        content_type="application/json",
    )
    assert r.status_code == 200
    assert "reply" in r.json()

def test_chat_returns_400_when_missing(client):
    r = client.post(
        URL,
        data=json.dumps({"message": ""}),
        content_type="application/json",
    )
    assert r.status_code == 400
    assert "required" in r.json().get("detail", "")


