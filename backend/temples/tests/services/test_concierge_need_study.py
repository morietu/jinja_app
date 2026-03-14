from __future__ import annotations

import pytest

from temples.services.concierge_chat import build_chat_recommendations
from temples.tests.fixtures.concierge_core_candidates import CONCIERGE_CORE_CANDIDATES


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("query", "expected_top_names"),
    [
        (
            "受験に向けて学業成就を祈願したい",
            ["太宰府天満宮", "亀戸天神社", "戸隠神社（中社）"],
        ),
        (
            "資格試験に受かりたい",
            ["太宰府天満宮", "亀戸天神社", "戸隠神社（中社）"],
        ),
        (
            "合格祈願をしたい",
            ["太宰府天満宮", "亀戸天神社", "戸隠神社（中社）"],
        ),
    ],
)
def test_study_queries_should_eventually_rank_study_shrines_high(query, expected_top_names, monkeypatch):


    recs = build_chat_recommendations(
        query=query,
        language="ja",
        candidates=CONCIERGE_CORE_CANDIDATES,
        birthdate=None,
        flow="A",
    )

    assert "recommendations" in recs
    assert len(recs["recommendations"]) > 0

    top_names = [r["name"] for r in recs["recommendations"][:3]]

    assert any(name in expected_top_names for name in top_names), (
        f"query={query!r} expected any of {expected_top_names} in top3, "
        f"but got top_names={top_names}"
    )


@pytest.mark.parametrize(
    ("query", "expected_tag"),
    [
        ("受験に向けて学業成就を祈願したい", "study"),
        ("資格試験に受かりたい", "study"),
        ("合格祈願をしたい", "study"),
    ],
)
def test_study_like_queries_resolve_to_study_need_tag(query, expected_tag, monkeypatch):


    recs = build_chat_recommendations(
        query=query,
        language="ja",
        candidates=CONCIERGE_CORE_CANDIDATES,
        birthdate=None,
        flow="A",
    )

    assert expected_tag in recs["_need"]["tags"]
