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

STUDY_REASON_HINTS = [
    "学業",
    "合格",
    "試験",
    "勉強",
    "学問",
]


def _collect_reason_texts(rec: dict) -> list[str]:
    texts: list[str] = []

    reason = rec.get("reason")
    if isinstance(reason, str) and reason.strip():
        texts.append(reason.strip())

    explanation = rec.get("explanation")
    if isinstance(explanation, str) and explanation.strip():
        texts.append(explanation.strip())

    bullets = rec.get("bullets") or []
    if isinstance(bullets, list):
        for b in bullets:
            if isinstance(b, str) and b.strip():
                texts.append(b.strip())

    reasons = rec.get("reasons") or []
    if isinstance(reasons, list):
        for item in reasons:
            if not isinstance(item, dict):
                continue
            text = item.get("text")
            if isinstance(text, str) and text.strip():
                texts.append(text.strip())
            label = item.get("label")
            if isinstance(label, str) and label.strip():
                texts.append(label.strip())

    return texts


@pytest.mark.django_db
@pytest.mark.parametrize("case", STUDY_REASON_CASES, ids=[c["id"] for c in STUDY_REASON_CASES])
def test_concierge_study_reasoning_mentions_study_context(case, monkeypatch):
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

    texts = _collect_reason_texts(top_rec)
    joined = " ".join(texts)

    assert joined.strip(), f"query={case['query']!r} top recommendation has no reason/explanation text"
    assert any(hint in joined for hint in STUDY_REASON_HINTS), (
        f"query={case['query']!r} expected study-related wording in top recommendation text, "
        f"but got texts={texts}"
    )
