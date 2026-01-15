# backend/temples/tests/api/test_concierge_chat_need_breakdown_contract.py
import json

import pytest

URL = "/api/concierge/chat/"


@pytest.mark.django_db
def test_concierge_chat_need_and_breakdown_contract(client, monkeypatch):
    """
    Contract (API):
      - res.json()["data"]["_need"] が常に dict で返る
        - tags: list[str] (最大3件想定)
        - hits: dict[str, list[str]]
      - res.json()["data"]["recommendations"][i]["breakdown"] が返る
        - score_element: int
        - score_need: int
        - score_popular: float (0..1)
        - score_total: float
        - weights: dict(element/need/popular)
        - matched_need_tags: list[str]
    """

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
                        "popular_score": 8.0,          # score_popular=0.8 を期待
                        "astro_elements": ["土"],      # score_element=2
                        "astro_tags": ["career", "rest"],
                    },
                    {
                        "name": "B",
                        "reason": "",
                        "popular_score": 3.0,          # score_popular=0.3
                        "astro_elements": ["水"],      # score_element=1
                        "astro_tags": ["mental"],
                    },
                    {
                        "name": "C",
                        "reason": "",
                        "popular_score": 0.0,          # score_popular=0.0
                        "astro_elements": ["火"],      # score_element=0
                        "astro_tags": [],
                    },
                ]
            }

    import temples.llm.orchestrator as orch

    monkeypatch.setattr(orch, "ConciergeOrchestrator", DummyOrchestrator, raising=True)

    # --- API call ---
    payload = {
        "message": "最近疲れが取れない。転職も不安。",
        "birthdate": "1984-05-15",
        "lat": 35.0,
        "lng": 139.0,
        "candidates": [{"name": "A"}, {"name": "B"}, {"name": "C"}],
    }

    r = client.post(URL, data=json.dumps(payload), content_type="application/json")
    assert r.status_code == 200

    j = r.json()
    assert j.get("ok") is True
    assert "data" in j and isinstance(j["data"], dict)

    data = j["data"]

    # ---- _need contract ----
    assert "_need" in data and isinstance(data["_need"], dict)
    assert data["_need"]["tags"] == ["career", "mental", "rest"]
    assert data["_need"]["hits"]["career"] == ["転職"]
    assert data["_need"]["hits"]["mental"] == ["不安"]
    assert data["_need"]["hits"]["rest"] == ["疲れ"]

    # ---- breakdown contract ----
    recs = data.get("recommendations")
    assert isinstance(recs, list)
    assert len(recs) == 3

    # 先頭(A)は pri=2 になるはず（ソートが変わっても name で取る）
    by_name = {x.get("name"): x for x in recs if isinstance(x, dict)}
    assert set(by_name.keys()) >= {"A", "B", "C"}

    a = by_name["A"]
    assert "breakdown" in a and isinstance(a["breakdown"], dict)
    bd = a["breakdown"]

    assert bd["weights"] == {"element": 0.6, "need": 0.3, "popular": 0.1}
    assert bd["score_element"] == 2
    assert bd["matched_need_tags"] == ["career", "rest"]
    assert bd["score_need"] == 2
    assert bd["score_popular"] == 0.8

    expected_total = 2 * 0.6 + 2 * 0.3 + 0.8 * 0.1
    assert bd["score_total"] == pytest.approx(expected_total, rel=1e-6)

    # B / C は形だけ最低限保証（過度に数値固定しない）
    for nm in ("B", "C"):
        it = by_name[nm]
        bd = it["breakdown"]
        assert set(bd.keys()) == {
            "score_element",
            "score_need",
            "score_popular",
            "score_total",
            "weights",
            "matched_need_tags",
        }
        assert isinstance(bd["score_element"], int)
        assert isinstance(bd["score_need"], int)
        assert isinstance(bd["score_popular"], float)
        assert isinstance(bd["score_total"], float)
        assert isinstance(bd["weights"], dict)
        assert isinstance(bd["matched_need_tags"], list)
