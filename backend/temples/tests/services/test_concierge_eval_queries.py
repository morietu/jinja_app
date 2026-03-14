# backend/temples/tests/services/test_concierge_eval_queries.py

import pytest

from temples.services.concierge_chat import build_chat_recommendations
from temples.tests.fixtures.concierge_eval_queries import CONCIERGE_EVAL_QUERIES
from temples.tests.fixtures.concierge_core_candidates import CONCIERGE_CORE_CANDIDATES


@pytest.mark.django_db
@pytest.mark.parametrize("case", CONCIERGE_EVAL_QUERIES)
def test_concierge_eval_queries(case, monkeypatch):


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
    top_names = [r["name"] for r in top_recs]

    assert case["expected_need"] in recs["_need"]["tags"]
    assert any(name in case["expected_top_names"] for name in top_names)

    top = recs["recommendations"][0]
    assert top["breakdown"]["score_need"] >= 0
