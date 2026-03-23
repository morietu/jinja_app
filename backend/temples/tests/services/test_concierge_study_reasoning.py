from __future__ import annotations

import pytest

from temples.services.concierge_chat import build_chat_recommendations
from temples.tests.fixtures.concierge_core_candidates import CONCIERGE_CORE_CANDIDATES


STUDY_REASON_CASES = [
    {
        "id": "study_reason_001",
        "query": "受験に向けて学業成就を祈願したい",
    },
    {
        "id": "study_reason_002",
        "query": "資格試験に受かりたい",
    },
    {
        "id": "study_reason_003",
        "query": "合格祈願をしたい",
    },
]


@pytest.mark.django_db
@pytest.mark.parametrize("case", STUDY_REASON_CASES, ids=[c["id"] for c in STUDY_REASON_CASES])
def test_concierge_study_explanation_uses_ja_label_not_raw_tag(case, monkeypatch):


    recs = build_chat_recommendations(
        query=case["query"],
        language="ja",
        candidates=CONCIERGE_CORE_CANDIDATES,
        birthdate=None,
        flow="A",
    )

    assert "recommendations" in recs
    assert len(recs["recommendations"]) > 0

    top_rec = recs["recommendations"][0]
    assert isinstance(top_rec, dict)

    explanation = top_rec.get("explanation") or {}
    reasons = explanation.get("reasons") or []

    texts: list[str] = []
    for item in reasons:
        if not isinstance(item, dict):
            continue
        text = item.get("text")
        if isinstance(text, str):
            texts.append(text)
        label = item.get("label")
        if isinstance(label, str):
            texts.append(label)

    joined = " ".join(texts)

    assert "study" not in joined
    assert "学業・合格" in joined


@pytest.mark.django_db
@pytest.mark.parametrize("case", STUDY_REASON_CASES, ids=[c["id"] for c in STUDY_REASON_CASES])
def test_concierge_study_reason_uses_study_label(case, monkeypatch):
    recs = build_chat_recommendations(
        query=case["query"],
        language="ja",
        candidates=CONCIERGE_CORE_CANDIDATES,
        birthdate=None,
        flow="A",
    )

    assert "recommendations" in recs
    assert len(recs["recommendations"]) > 0

    top_rec = recs["recommendations"][0]
    assert isinstance(top_rec, dict)

    reason = str(top_rec.get("reason") or "")
    assert "study" not in reason
    assert "学業や合格" in reason
    assert "参拝先" in reason
    assert "適しています" in reason
