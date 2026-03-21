# backend/temples/tests/services/test_concierge_acceptance_queries.py
import pytest

from temples.tests.fixtures.concierge_core_candidates import CONCIERGE_CORE_CANDIDATES
from temples.tests.fixtures.concierge_acceptance_queries import CONCIERGE_ACCEPTANCE_QUERIES
from temples.services.concierge_chat import build_chat_recommendations


def _normalize_text(text: str) -> str:
    return (
        (text or "")
        .replace("落ち着いて", "落ち着")
        .replace("落ち着ける", "落ち着")
        .replace("心を整えたり", "心を整え")
        .strip()
    )

def _contains_any(text: str, needles: list[str]) -> bool:
    material = _normalize_text(text)
    return any(n in material for n in needles)


def _join_top3_text(top3: list[dict]) -> str:
    parts: list[str] = []
    for rec in top3:
        parts.extend(
            [
                str(rec.get("name") or ""),
                str(rec.get("reason") or ""),
                str(((rec.get("explanation") or {}).get("summary")) or ""),
                str(rec.get("goriyaku") or ""),
                str(rec.get("description") or ""),
            ]
        )
    return " ".join(parts)


@pytest.mark.django_db
@pytest.mark.parametrize("case", CONCIERGE_ACCEPTANCE_QUERIES, ids=[c["id"] for c in CONCIERGE_ACCEPTANCE_QUERIES])
def test_concierge_acceptance_queries(case):
    recs = build_chat_recommendations(
        query=case["query"],
        language="ja",
        candidates=CONCIERGE_CORE_CANDIDATES,
        bias=None,
        birthdate=None,
        goriyaku_tag_ids=None,
        extra_condition=None,
        public_mode="need",
        flow="A",
    )

    assert recs["recommendations"], f'{case["id"]}: recommendations is empty'

    top3 = recs["recommendations"][:3]
    top1 = top3[0]

    # 1) expected_need
    actual_need_tags = recs.get("_need", {}).get("tags", [])
    for expected_tag in case["expected_need"]:
        assert expected_tag in actual_need_tags, (
            f'{case["id"]}: expected_need={expected_tag} not in actual={actual_need_tags}'
        )

    # 2) top1 must satisfy
    top1_material = " ".join(
        [
            str(top1.get("name") or ""),
            str(top1.get("reason") or ""),
            str(((top1.get("explanation") or {}).get("summary")) or ""),
            str(top1.get("goriyaku") or ""),
            str(top1.get("description") or ""),
        ]
    )
    assert _contains_any(top1_material, case["top1_must_match_any"]), (
        f'{case["id"]}: top1 does not satisfy expected condition. material={top1_material}'
    )

    # 3) summary context
    summary = ((top1.get("explanation") or {}).get("summary")) or ""
    assert _contains_any(summary, case["expected_summary_context_any"]), (
        f'{case["id"]}: summary context mismatch. summary={summary}'
    )

    # 4) reasons[0] context
    reasons = ((top1.get("explanation") or {}).get("reasons")) or []
    first_reason_text = str(reasons[0].get("text") if reasons else "")
    assert _contains_any(first_reason_text, case["expected_reason_context_any"]), (
        f'{case["id"]}: reasons[0] context mismatch. reason={first_reason_text}'
    )

    # 5) top3 overall sanity
    top3_material = _join_top3_text(top3)
    assert _contains_any(top3_material, case["top1_must_match_any"]), (
        f'{case["id"]}: top3 overall relevance looks weak. top3_material={top3_material}'
    )


def _score_top3_alignment(top3: list[dict], keywords: list[str]) -> list[int]:
    scores: list[int] = []
    for rec in top3:
        material = " ".join(
            [
                str(rec.get("reason") or ""),
                str(((rec.get("explanation") or {}).get("summary")) or ""),
                str(rec.get("goriyaku") or ""),
                str(rec.get("description") or ""),
            ]
        )
        score = sum(1 for k in keywords if k in material)
        scores.append(score)
    return scores
