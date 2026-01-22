# temples/tests/test_concierge_flow_b_contract.py
import pytest
from temples.services.concierge_chat import build_chat_recommendations


@pytest.mark.django_db
def test_flow_b_contract(monkeypatch):
    # Orchestrator を固定（外部LLMとかに触らない）
    class DummyOrchestrator:
        def suggest(self, *, query, candidates):
            # Orchestratorは1件だけ返す（残りは _finalize_3 が candidates で埋める想定）
            return {"recommendations": [{"name": "A", "reason": ""}]}

    import temples.llm.orchestrator as orch
    monkeypatch.setattr(orch, "ConciergeOrchestrator", DummyOrchestrator, raising=True)

    # candidates は最低3件 + lat/lng を付ける（geoフィルタで落ちないため）
    candidates = [
        {"name": "A", "lat": 1, "lng": 1},
        {"name": "B", "lat": 1, "lng": 1},
        {"name": "C", "lat": 1, "lng": 1},
    ]

    recs = build_chat_recommendations(
        query="近場で縁結び",
        language="ja",
        candidates=candidates,
        bias=None,
        birthdate="2000-03-21",
        flow="B",
    )

    assert "_signals" in recs
    assert "mode" in recs["_signals"]

    mode = recs["_signals"]["mode"]
    assert mode["flow"] == "B"
    assert mode["weights"] == {"element": 0.8, "need": 0.2, "popular": 0.0}
    assert mode["astro_bonus_enabled"] is False
