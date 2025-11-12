import json

def test_schema_has_concierge_chat(client):
    r = client.get("/api/schemas/")
    assert r.status_code == 200
    data = json.loads(r.content)
    paths = data.get("paths", {}) or {}
    assert any("/api/concierge/chat/" in p for p in paths.keys())
