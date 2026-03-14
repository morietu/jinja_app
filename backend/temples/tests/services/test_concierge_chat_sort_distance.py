# temples/tests/services/test_concierge_chat_sort_distance.py
import pytest

from temples.services.concierge_chat import build_chat_recommendations

@pytest.mark.django_db
def test_sort_distance_forces_distance_order(monkeypatch):
    # Orchestrator を固定（recommendations は順不同で返す）
    class DummyOrchestrator:
        def suggest(self, *, query, candidates):
            return {
                "recommendations": [
                    {"name": "B", "reason": "", "popular_score": 0},
                    {"name": "A", "reason": "", "popular_score": 0},
                    {"name": "C", "reason": "", "popular_score": 0},
                ]
            }

    import temples.llm.orchestrator as orch
    monkeypatch.setattr(orch, "ConciergeOrchestrator", DummyOrchestrator, raising=True)


    # candidates 側に distance_m を持たせる（Aが最短）
    candidates = [
        {"name": "A", "lat": 1.0, "lng": 1.0, "distance_m": 100},
        {"name": "B", "lat": 1.0, "lng": 1.0, "distance_m": 300},
        {"name": "C", "lat": 1.0, "lng": 1.0, "distance_m": 200},
    ]

    recs = build_chat_recommendations(
        query="test",
        language="ja",
        candidates=candidates,
        bias=None,
        birthdate="1994-05-15",
        extra_condition="できるだけ近い場所を優先して",  # ← sort_distance を出す
        goriyaku_tag_ids=None,
        flow="A",
    )

    names = [r["name"] for r in recs["recommendations"]]
    assert names == ["A", "C", "B"]
