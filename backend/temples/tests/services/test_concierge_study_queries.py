from __future__ import annotations

import pytest

from temples.services.concierge_chat import build_chat_recommendations
from temples.tests.fixtures.concierge_core_candidates import CONCIERGE_CORE_CANDIDATES


STUDY_CASES = [
    {
        "id": "study_001",
        "query": "受験に向けて学業成就を祈願したい",
        "expected_need": "study",
        "expected_top_names": ["太宰府天満宮", "亀戸天神社", "戸隠神社（中社）"],
    },
    {
        "id": "study_002",
        "query": "資格試験に受かりたい",
        "expected_need": "study",
        "expected_top_names": ["太宰府天満宮", "亀戸天神社", "戸隠神社（中社）"],
    },
    {
        "id": "study_003",
        "query": "合格祈願をしたい",
        "expected_need": "study",
        "expected_top_names": ["太宰府天満宮", "亀戸天神社", "戸隠神社（中社）"],
    },
]


@pytest.mark.django_db
@pytest.mark.parametrize("case", STUDY_CASES, ids=[c["id"] for c in STUDY_CASES])
def test_concierge_study_queries(case, monkeypatch):


    recs = build_chat_recommendations(
        query=case["query"],
        language="ja",
        candidates=CONCIERGE_CORE_CANDIDATES,
        birthdate=None,
        flow="A",
    )

    assert "recommendations" in recs
    assert len(recs["recommendations"]) > 0
    assert case["expected_need"] in recs["_need"]["tags"]

    top_names = [r["name"] for r in recs["recommendations"][:3]]
    assert any(name in case["expected_top_names"] for name in top_names), (
        f"case={case['id']} expected any of {case['expected_top_names']} in top3, "
        f"but got top_names={top_names}"
    )
