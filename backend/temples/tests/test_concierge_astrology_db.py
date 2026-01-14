# backend/temples/tests/test_concierge_astrology_db.py
import pytest

from temples.models import Shrine
from temples.services.concierge_chat import build_chat_recommendations


@pytest.mark.django_db
def test_chat_astrology_uses_db_astro_elements_and_picks_top3(monkeypatch):
    """
    目的:
      - recommendations に astro_elements が無い場合でも、DBから埋められる（attach）
      - birthdate が有効なら astrology filter が走り、最大3件に絞られる（pick）
      - 優先度の高い要素（ここでは fire）が優先されることを確認する

    方針:
      - Shrine をテストDBに作る（name_jp で拾われるので name_jp を一致させる）
      - Orchestrator は候補名だけ返す（astro_elements を付けない）
      - element_priority を monkeypatch して判定を安定させる
    """

    # --- テストDBに shrine を作る（attach_astro_elements_to_recs が name_jp__icontains で拾う） ---
    Shrine.objects.create(name_jp="A", astro_elements=["fire"])
    Shrine.objects.create(name_jp="B", astro_elements=["water"])
    Shrine.objects.create(name_jp="C", astro_elements=["fire"])
    Shrine.objects.create(name_jp="D", astro_elements=[])
    Shrine.objects.create(name_jp="E", astro_elements=["fire"])

    # --- Orchestrator を固定（astro_elements を recommendations に入れないのがポイント） ---
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

    # --- 優先度ロジックをテスト内で固定して安定化 ---
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
        birthdate="2000-03-21",  # 火っぽい想定（ただし判定自体は fake_element_priority で安定化）
    )

    assert isinstance(recs, dict)
    assert len(recs["recommendations"]) == 3
    assert "_astro" in recs  # birthdate が有効なら付与される

    names = [r.get("name") for r in recs["recommendations"]]
    assert names == ["A", "C", "E"]

    # ついでに DBから埋まってることも見る（A が fire を持つ）
    assert recs["recommendations"][0].get("astro_elements") == ["fire"]
