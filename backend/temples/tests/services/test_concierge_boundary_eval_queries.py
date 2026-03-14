from __future__ import annotations

import pytest

from temples.services.concierge_chat import build_chat_recommendations
from temples.tests.fixtures.concierge_core_candidates import CONCIERGE_CORE_CANDIDATES


BOUNDARY_EVAL_CASES = [
    {
        "id": "boundary_study_career_001",
        "query": "資格を取って転職に活かしたい",
        "expected_need": "study",
        "expected_top_names": ["太宰府天満宮", "亀戸天神社", "戸隠神社（中社）"],
        "note": "転職目的を含むが、主語は資格取得なので study 優先",
    },
    {
        "id": "boundary_study_career_002",
        "query": "就職試験に受かりたい",
        "expected_need": "study",
        "expected_top_names": ["太宰府天満宮", "亀戸天神社", "戸隠神社（中社）"],
        "note": "就職文脈を含んでも、試験突破は study に寄せる",
    },
    {
        "id": "boundary_study_career_003",
        "query": "面接を突破して仕事の流れを変えたい",
        "expected_need": "career",
        "expected_top_names": ["神田神社（神田明神）", "猿田彦神社", "鶴岡八幡宮", "宇佐神宮"],
        "note": "選考要素はあるが、主眼は仕事運・転機なので career",
    },
    {
        "id": "boundary_study_career_004",
        "query": "勉強に集中して合格をつかみたい",
        "expected_need": "study",
        "expected_top_names": ["太宰府天満宮", "亀戸天神社", "戸隠神社（中社）"],
        "note": "純粋な学習・合格文脈",
    },
    {
        "id": "boundary_study_career_005",
        "query": "新しい分野を学び直して挑戦を成功させたい",
        "expected_need": "study",
        "expected_top_names": ["太宰府天満宮", "亀戸天神社", "戸隠神社（中社）"],
        "note": "挑戦を含むが、学び直しが主なので study",
    },
    {
        "id": "boundary_rest_mental_001",
        "query": "最近不安が強いので少し休みたい",
        "expected_need": "mental",
        "expected_top_names": ["明治神宮", "熊野本宮大社", "春日大社", "伊勢神宮（内宮）"],
        "note": "休みたいを含むが、不安の処理が主なので mental",
    },
    {
        "id": "boundary_rest_mental_002",
        "query": "気持ちを落ち着けて静かに過ごしたい",
        "expected_need": "rest",
        "expected_top_names": ["春日大社", "明治神宮", "熊野本宮大社", "伊勢神宮（内宮）"],
        "note": "静けさ・休息が主なので rest",
    },
    {
        "id": "boundary_rest_mental_003",
        "query": "厄を落として心を整えたい",
        "expected_need": "mental",
        "expected_top_names": ["明治神宮", "春日大社", "熊野本宮大社", "伊勢神宮（内宮）"],
        "note": "厄除けと心の立て直しは mental",
    },
    {
        "id": "boundary_rest_mental_004",
        "query": "疲れているので自然の中で何も考えず休みたい",
        "expected_need": "rest",
        "expected_top_names": ["伊勢神宮（内宮）", "熊野本宮大社", "富士山本宮浅間大社", "春日大社"],
        "note": "疲労回復と静養が主なので rest",
    },
    {
        "id": "boundary_rest_mental_005",
        "query": "心を整えつつ少し距離を置いて休みたい",
        "expected_need": "mental",
        "expected_top_names": ["明治神宮", "熊野本宮大社", "春日大社", "伊勢神宮（内宮）"],
        "note": "休息を含むが、心の調整が主目的なので mental",
    },
]


@pytest.mark.django_db
@pytest.mark.parametrize(
    "case",
    BOUNDARY_EVAL_CASES,
    ids=[c["id"] for c in BOUNDARY_EVAL_CASES],
)
def test_concierge_boundary_eval_queries(case, monkeypatch):
    

    recs = build_chat_recommendations(
        query=case["query"],
        language="ja",
        candidates=CONCIERGE_CORE_CANDIDATES,
        birthdate=None,
        flow="A",
    )

    assert "recommendations" in recs
    assert len(recs["recommendations"]) > 0

    top_recs = recs["recommendations"][:3]
    top_names = [r["name"] for r in top_recs if isinstance(r, dict) and r.get("name")]

    assert case["expected_need"] in recs["_need"]["tags"], (
        f"case={case['id']} query={case['query']!r} "
        f"expected_need={case['expected_need']!r}, got need_tags={recs['_need']['tags']!r}"
    )

    assert any(name in case["expected_top_names"] for name in top_names), (
        f"case={case['id']} query={case['query']!r} expected any of "
        f"{case['expected_top_names']} in top3, but got top_names={top_names}"
    )
