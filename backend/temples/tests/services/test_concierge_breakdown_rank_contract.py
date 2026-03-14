# -*- coding: utf-8 -*-
import pytest

from temples.services.concierge_chat import build_chat_recommendations

@pytest.mark.django_db
def test_breakdown_score_total_is_contract_value_but_sort_uses_ranked_score(monkeypatch):
    """
    CR-003:
    APIの breakdown.score_total は契約用スコア。
    実際の並び順は rec['_score_total']（内部ランキング用）で決まる。

    つまり:
      - A/B の breakdown.score_total は同じ
      - ただし matched_by_tag の強さ差で A が上に来る
    という状態を固定する。
    """

    candidates = [
        {
            "id": 1,
            "shrine_id": 1,
            "name": "TAG優先神社",
            "distance_m": 1000,
            "astro_tags": ["career"],  # matched_by_tag=1 -> rank_raw=2
            "goriyaku": "",
            "description": "",
            "astro_elements": [],
            "popular_score": 0,
        },
        {
            "id": 2,
            "shrine_id": 2,
            "name": "TEXT優先神社",
            "distance_m": 1000,
            "astro_tags": [],          # matched_by_tag=0
            "goriyaku": "仕事運",       # matched_by_text=1 -> rank_raw=1
            "description": "",
            "astro_elements": [],
            "popular_score": 0,
        },
    ]

    recs = build_chat_recommendations(
        query="仕事で良い流れをつかみたい",
        language="ja",
        candidates=candidates,
        birthdate=None,
        flow="A",
        need_tags=["career"],  # need抽出の揺れを固定
        llm_enabled=False,
    )

    top = recs["recommendations"]
    assert [x["name"] for x in top[:2]] == ["TAG優先神社", "TEXT優先神社"]

    by_name = {x["name"]: x for x in top}
    a = by_name["TAG優先神社"]
    b = by_name["TEXT優先神社"]

    # 契約上の need score はどちらも 1
    assert a["breakdown"]["score_need"] == 1
    assert b["breakdown"]["score_need"] == 1

    # 契約上の total も同じ
    assert a["breakdown"]["score_total"] == pytest.approx(0.3, rel=1e-6)
    assert b["breakdown"]["score_total"] == pytest.approx(0.3, rel=1e-6)

    # ただし内部ランキングでは tag一致の方が強い
    assert a["_score_total"] > b["_score_total"]

    # 差分理由が detail に残っていること
    assert a["breakdown_detail"]["features"]["need"]["rank_raw"] == 2
    assert b["breakdown_detail"]["features"]["need"]["rank_raw"] == 1
