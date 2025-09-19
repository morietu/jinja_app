import pytest
from rest_framework.test import APIClient

@pytest.mark.django_db
def test_concierge_chat_returns_200():
    c = APIClient()
    resp = c.post("/api/concierge/chat/", {"query": "近場で縁結び"}, format="json")
    assert resp.status_code == 200
    js = resp.json()
    assert js.get("ok") is True
