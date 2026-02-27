import pytest
from django.test import override_settings
from temples.services.concierge_chat import build_chat_recommendations
import temples.domain.astrology as astro


def fake_element_priority(user_element, rec_elements):
    rec_elements = rec_elements or []
    if "fire" in rec_elements:
        return 2
    if "water" in rec_elements:
        return 1
    return 0

@override_settings(CONCIERGE_USE_LLM=True)
@pytest.mark.django_db
def test_chat_astrology_picks_top3_by_element_priority(monkeypatch):
    """
    birthdate が有効なとき：
    - astrology が有効化される
    - pri=2 > 1 > 0 の順で最大3件に絞られる
    """

    # ★ ここで monkeypatch
    monkeypatch.setattr(
        astro,
        "element_priority",
        fake_element_priority,
        raising=True,
    )

    class DummyOrchestrator:
        def suggest(self, *, query, candidates):
            return {
                "recommendations": [
                    {"name": "A", "astro_elements": ["fire"], "reason": ""},
                    {"name": "B", "astro_elements": ["water"], "reason": ""},
                    {"name": "C", "astro_elements": ["fire"], "reason": ""},
                    {"name": "D", "astro_elements": [], "reason": ""},
                    {"name": "E", "astro_elements": ["fire"], "reason": ""},
                ]
            }

    import temples.llm.orchestrator as orch
    monkeypatch.setattr(orch, "ConciergeOrchestrator", DummyOrchestrator, raising=True)

    recs = build_chat_recommendations(
        query="近場で縁結び",
        language="ja",
        candidates=[{"name": "A"}, {"name": "B"}],
        bias=None,
        birthdate="2000-03-21",
    )

    names = [r["name"] for r in recs["recommendations"]]
    assert names == ["A", "C", "E"]
    assert "_astro" in recs


@override_settings(CONCIERGE_USE_LLM=True)
@pytest.mark.django_db
def test_chat_astrology_ignored_when_birthdate_invalid(monkeypatch):
    """
    birthdate が無効なとき：
    - astrology は無効
    - Orchestrator の先頭3件をそのまま返す
    """
    monkeypatch.setattr(astro, "element_priority", fake_element_priority, raising=True)

    class DummyOrchestrator:
        def suggest(self, *, query, candidates):
            return {
                "recommendations": [
                    {"name": "A", "astro_elements": ["fire"], "reason": ""},
                    {"name": "B", "astro_elements": ["water"], "reason": ""},
                    {"name": "C", "astro_elements": [], "reason": ""},
                    {"name": "D", "astro_elements": ["fire"], "reason": ""},
                ]
            }

    import temples.llm.orchestrator as orch
    monkeypatch.setattr(orch, "ConciergeOrchestrator", DummyOrchestrator, raising=True)

    recs = build_chat_recommendations(
        query="近場で縁結び",
        language="ja",
        candidates=[{"name": "seed"}],  # ← 空にしない（ここが肝）
        bias=None,
        birthdate="not-a-date",
    )

    names = [r["name"] for r in recs["recommendations"]]
    assert names == ["A", "B", "C"]
    assert "_astro" not in recs
