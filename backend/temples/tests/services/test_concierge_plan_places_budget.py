# backend/temples/tests/services/test_concierge_plan_places_budget.py
import os

import pytest

from temples.services import concierge_plan as plan


@pytest.mark.parametrize(
    "max_lookups, expected_calls",
    [
        ("0", 0),
        ("1", 1),
        ("2", 2),
    ],
)
def test_plan_places_budget_respects_plan_max_place_lookups(monkeypatch, max_lookups, expected_calls):
    # env を固定
    monkeypatch.setenv("PLAN_DISABLE_PLACES", "0")
    monkeypatch.setenv("PLAN_MAX_PLACE_LOOKUPS", max_lookups)

    calls = {"n": 0}

    # ★ findplacefromtext をカウントする（外部I/O契約）
    def fake_findplacefromtext(**kw):
        calls["n"] += 1
        # 座標は返さない（got_coords が立たない状態で上限まで叩かせる）
        return {"candidates": [{"geometry": {"location": {}}}]}

    monkeypatch.setattr(plan.GP, "findplacefromtext", fake_findplacefromtext)

    filled = {
        "recommendations": [
            {"name": "神社A", "location": None},
            {"name": "神社B", "location": None},
            {"name": "神社C", "location": None},
        ]
    }

    out = plan._apply_cost_guarded_place_enrichment(
        filled=filled,
        area="東京駅",
        language="ja",
        locbias="circle:5000@35.0,135.0",
        disable_places=False,
    )

    assert isinstance(out, dict)
    assert calls["n"] == expected_calls


def test_plan_places_budget_stops_after_getting_one_coord(monkeypatch):
    # got_coords >= 1 で lookup を止める契約
    monkeypatch.setenv("PLAN_DISABLE_PLACES", "0")
    monkeypatch.setenv("PLAN_MAX_PLACE_LOOKUPS", "10")  # 大きくしても止まることを見たい

    calls = {"n": 0}

    def fake_findplacefromtext(**kw):
        calls["n"] += 1
        # 1回目で座標が取れた想定 → got_coords が 1 になって残りは叩かない
        if calls["n"] == 1:
            return {
                "candidates": [
                    {"geometry": {"location": {"lat": 35.0, "lng": 135.0}}}
                ]
            }
        # ここに来たらおかしい（止まってない）
        return {"candidates": [{"geometry": {"location": {"lat": 0.0, "lng": 0.0}}}]}

    monkeypatch.setattr(plan.GP, "findplacefromtext", fake_findplacefromtext)

    filled = {
        "recommendations": [
            {"name": "神社A", "location": None},
            {"name": "神社B", "location": None},
            {"name": "神社C", "location": None},
        ]
    }

    out = plan._apply_cost_guarded_place_enrichment(
        filled=filled,
        area="東京駅",
        language="ja",
        locbias="circle:5000@35.0,135.0",
        disable_places=False,
    )

    assert isinstance(out, dict)
    assert calls["n"] == 1
