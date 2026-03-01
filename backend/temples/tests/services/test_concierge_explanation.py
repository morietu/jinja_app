import pytest
from temples.services.concierge_explanation import (
    attach_explanations_for_chat,
    build_explanation_for_plan_rec,
)

def _assert_reasons_shape(exp: dict) -> None:
    assert isinstance(exp, dict)
    assert "reasons" in exp
    assert isinstance(exp["reasons"], list)
    assert all(isinstance(x, dict) for x in exp["reasons"])
    assert len(exp["reasons"]) <= 3

def _codes(exp: dict) -> list[str]:
    return [
        str(r.get("code"))
        for r in (exp.get("reasons") or [])
        if isinstance(r, dict) and r.get("code") is not None
    ]

def test_chat_user_condition_included_when_nonblank():
    recs = {
        "recommendations": [
            {"name": "A", "breakdown": {"score_element": 2, "matched_need_tags": ["厄除け"]}}
        ]
    }
    out = attach_explanations_for_chat(
        recs,
        query="test",
        bias=None,
        birthdate=None,
        extra_condition=" 静か ",
    )
    exp = out["recommendations"][0]["explanation"]
    _assert_reasons_shape(exp)
    assert "USER_CONDITION" in _codes(exp)


def test_chat_user_condition_not_included_when_blank():
    recs = {
        "recommendations": [
            {"name": "A", "breakdown": {"score_element": 2, "matched_need_tags": ["厄除け"]}}
        ]
    }
    out = attach_explanations_for_chat(
        recs,
        query="test",
        bias=None,
        birthdate=None,
        extra_condition="   ",
    )
    exp = out["recommendations"][0]["explanation"]
    _assert_reasons_shape(exp)
    assert "USER_CONDITION" not in _codes(exp)


def test_plan_area_match_survives_take3():
    rec = {"name": "A", "breakdown": {"score_element": 2, "matched_need_tags": ["厄除け"]}}
    exp = build_explanation_for_plan_rec(
        rec,
        query="test",
        area="浅草",
        bias=None,
        birthdate=None,
        wish=None,
    )
    _assert_reasons_shape(exp)
    assert "AREA_MATCH" in _codes(exp)
