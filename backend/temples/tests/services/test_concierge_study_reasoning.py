from __future__ import annotations

import pytest

import temples.services.concierge_chat as chat_mod
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
    monkeypatch.setattr(chat_mod, "_apply_location_backfill", lambda *args, **kwargs: None)

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
    monkeypatch.setattr(chat_mod, "_apply_location_backfill", lambda *args, **kwargs: None)

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
    assert top_rec.get("reason") == "学業や合格を願う参拝に"
