import pytest
from rest_framework.test import APIClient

@pytest.mark.django_db
def test_concierge_recommend_limit_premium(monkeypatch):
    client = APIClient()

    monkeypatch.setenv("BILLING_STUB_PLAN", "premium")
    monkeypatch.setenv("BILLING_STUB_ACTIVE", "1")

    def fake_orchestrate(*args, **kwargs):
        return {"recommendations": [{"name": f"神社{i}", "reason": "x"} for i in range(10)]}

    monkeypatch.setattr("temples.llm.orchestrator.orchestrate_concierge", fake_orchestrate)

    res = client.post("/api/concierge/chat/", data={"query": "金運"}, format="json")

    print("status:", res.status_code)
    print("content-type:", res.headers.get("Content-Type"))
    print("body:", res.content.decode("utf-8"))

    assert res.status_code == 200
    recs = res.json()["data"]["recommendations"]
    assert len(recs) <= 3
