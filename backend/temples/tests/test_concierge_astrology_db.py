import pytest
from temples.services.concierge_chat import build_chat_recommendations
from temples.models import Shrine

@pytest.mark.django_db
def test_chat_astrology_uses_db_astro_elements_and_picks_top3(monkeypatch, settings):
    """
    NOTE:
      - このテストは LLM enabled 前提（settings.CONCIERGE_USE_LLM=True）。
      - candidates=[] のため、LLM無効だと orchestrator が呼ばれず recommendations が空になりうる。
      - 目的は「recommendations に astro_elements が無くても DB から attach され、top3 が pick される」ことの検証。
    """
    settings.CONCIERGE_USE_LLM = True
    monkeypatch.setenv("CHAT_MAX_ADDRESS_LOOKUPS", "0")

    Shrine.objects.create(name_jp="A", astro_elements=["fire"])
    Shrine.objects.create(name_jp="B", astro_elements=["water"])
    Shrine.objects.create(name_jp="C", astro_elements=["fire"])
    Shrine.objects.create(name_jp="D", astro_elements=[])
    Shrine.objects.create(name_jp="E", astro_elements=["fire"])

    class DummyOrchestrator:
        def suggest(self, *, query, candidates):
            return {
                "recommendations": [
                    {"name": "A", "reason": ""},
                    {"name": "B", "reason": ""},
                    {"name": "C", "reason": ""},
                    {"name": "D", "reason": ""},
                    {"name": "E", "reason": ""},
                ]
            }

    import temples.llm.orchestrator as orch
    monkeypatch.setattr(orch, "ConciergeOrchestrator", DummyOrchestrator, raising=True)

    import temples.domain.astrology as astro
    def fake_element_priority(user_element, rec_elements):
        rec_elements = rec_elements or []
        if "fire" in rec_elements:
            return 2
        if "water" in rec_elements:
            return 1
        return 0
    monkeypatch.setattr(astro, "element_priority", fake_element_priority, raising=True)

    recs = build_chat_recommendations(
        query="近場で縁結び",
        language="ja",
        candidates=[],
        bias=None,
        birthdate="2000-03-21",
    )

    assert len(recs["recommendations"]) == 3
