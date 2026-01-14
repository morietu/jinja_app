# backend/temples/tests/test_concierge_need_contract.py
import pytest

from temples.services.concierge_chat import build_chat_recommendations


@pytest.mark.django_db
def test_concierge_need_contract_need_and_breakdown(monkeypatch):
    """
    Contract:
      - build_chat_recommendations は data._need を返す
        - _need.tags: 最大3件、優先度順
        - _need.hits: どの語で当たったか（デバッグ用）
      - recommendations[i].breakdown を返す
        - score_element: 0/1/2
        - score_need: matched_need_tags の件数（最小構成）
        - score_popular: popular_score を 0..1 に正規化（popular/10 を clamp）
        - score_total: score_element*W1 + score_need*W2 + score_popular*W3
        - weights: {element, need, popular}
        - matched_need_tags: need_tags ∩ shrine_astro_tags
    """

    query = "最近疲れが取れない。転職も不安。"

    # --- need_tags.extract_need_tags を固定（辞書実装の揺れを避ける）---
    class FakeNeedExtract:
        def __init__(self):
            self.tags = ["career", "mental", "rest"]
            self.hits = {"career": ["転職"], "mental": ["不安"], "rest": ["疲れ"]}

    import temples.domain.need_tags as need

    monkeypatch.setattr(
        need,
        "extract_need_tags",
        lambda q, max_tags=3: FakeNeedExtract(),
        raising=True,
    )

    # --- astrology を固定（誕生日→土 / element_priority を固定）---
    import temples.domain.astrology as astro

    class _Prof:
        sign = "牡牛座"
        element = "土"

    monkeypatch.setattr(
        astro,
        "sun_sign_and_element",
        lambda birthdate: _Prof(),
        raising=True,
    )

    # 土（earth）一致なら2、水なら1、それ以外0（最小の検証用）
    def fake_element_priority(user_elem, shrine_elems):
        shrine_elems = shrine_elems or []
        s = {str(x).strip() for x in shrine_elems if str(x).strip()}
        if "土" in s:
            return 2
        if "水" in s:
            return 1
        return 0

    monkeypatch.setattr(astro, "element_priority", fake_element_priority, raising=True)

    # --- Orchestrator を固定（recommendations 3件）---
    class DummyOrchestrator:
        def suggest(self, *, query, candidates):
            return {
                "recommendations": [
                    {
                        "name": "A",
                        "reason": "",
                        "popular_score": 8.0,           # score_popular=0.8 を期待
                        "astro_elements": ["土"],       # score_element=2 を期待
                        "astro_tags": ["career", "rest"],
                    },
                    {
                        "name": "B",
                        "reason": "",
                        "popular_score": 3.0,           # score_popular=0.3
                        "astro_elements": ["水"],       # score_element=1
                        "astro_tags": ["mental"],
                    },
                    {
                        "name": "C",
                        "reason": "",
                        "popular_score": 0.0,           # score_popular=0.0
                        "astro_elements": ["火"],       # score_element=0
                        "astro_tags": [],
                    },
                ]
            }

    import temples.llm.orchestrator as orch

    monkeypatch.setattr(orch, "ConciergeOrchestrator", DummyOrchestrator, raising=True)

    recs = build_chat_recommendations(
        query=query,
        language="ja",
        candidates=[{"name": "A"}, {"name": "B"}, {"name": "C"}],
        bias=None,
        birthdate="1984-05-15",
    )

    # ---- _need contract ----
    assert isinstance(recs, dict)
    assert "_need" in recs
    assert recs["_need"]["tags"] == ["career", "mental", "rest"]
    assert recs["_need"]["hits"]["career"] == ["転職"]
    assert recs["_need"]["hits"]["mental"] == ["不安"]
    assert recs["_need"]["hits"]["rest"] == ["疲れ"]

    # ---- breakdown contract ----
    items = recs["recommendations"]
    assert len(items) == 3

    # A: element=2, need=2, popular=0.8
    a = items[0]
    assert a["name"] == "A"
    assert "breakdown" in a
    bd = a["breakdown"]

    assert bd["weights"] == {"element": 0.6, "need": 0.3, "popular": 0.1}
    assert bd["score_element"] == 2
    assert bd["matched_need_tags"] == ["career", "rest"]
    assert bd["score_need"] == 2
    assert bd["score_popular"] == 0.8

    expected_total = 2 * 0.6 + 2 * 0.3 + 0.8 * 0.1
    assert bd["score_total"] == pytest.approx(expected_total, rel=1e-6)

    # B: element=1, need=1, popular=0.3
    b = items[1]
    bd = b["breakdown"]
    assert bd["score_element"] == 1
    assert bd["matched_need_tags"] == ["mental"]
    assert bd["score_need"] == 1
    assert bd["score_popular"] == 0.3

    # C: element=0, need=0, popular=0.0
    c = items[2]
    bd = c["breakdown"]
    assert bd["score_element"] == 0
    assert bd["matched_need_tags"] == []
    assert bd["score_need"] == 0
    assert bd["score_popular"] == 0.0
