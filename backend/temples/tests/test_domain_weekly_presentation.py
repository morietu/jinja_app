"""Weekly Presentation Domain（fingerprint / owner key / featured選択）のUnit Test。

Reproducibility Contract と Candidate Universe 境界を、既存Recommendation層を
一切動かさずに（純粋関数として）検証する。
"""

from __future__ import annotations

import json
import subprocess
import sys
from datetime import date
from pathlib import Path

import pytest

from temples.domain import weekly_presentation
from temples.domain.weekly_presentation import (
    DIRECTION_FINGERPRINT_FIELDS,
    WEEKLY_FEATURED_LIMIT,
    WEEKLY_POOL_LIMIT,
    WEEKLY_PRESENTATION_VERSION,
    build_direction_fingerprint,
    build_weekly_featured_seed,
    build_weekly_owner_key,
    build_weekly_pool,
    build_weekly_theme_seed,
    select_featured_shrine_ids,
    stable_index,
)

WEEK_START = date(2026, 9, 7)
PURPOSE = "career"

DIRECTION_CONTEXT = {
    "targetDate": "2026-09-15",
    "targetYear": 2026,
    "solarMonthIndex": 8,
    "referenceDirections": ["北西", "南"],
    "calculationMethod": "annual_monthly_kyusei_v1",
    "note": "方位は参考情報です",
}


def _recommendations(*shrine_ids: int) -> list[dict]:
    return [{"shrine_id": shrine_id, "name": f"神社{shrine_id}"} for shrine_id in shrine_ids]


def _fingerprint() -> str:
    return build_direction_fingerprint(DIRECTION_CONTEXT)


# --------------------------------------------------------------------------
# presentation_version
# --------------------------------------------------------------------------


def test_presentation_version_is_the_single_v1_constant():
    assert WEEKLY_PRESENTATION_VERSION == "weekly_presentation_v1"


def test_weekly_limits_are_fixed_constants():
    assert WEEKLY_POOL_LIMIT == 6
    assert WEEKLY_FEATURED_LIMIT == 3


# --------------------------------------------------------------------------
# direction_fingerprint
# --------------------------------------------------------------------------


def test_fingerprint_is_sha256_hex():
    fingerprint = _fingerprint()
    assert len(fingerprint) == 64
    assert set(fingerprint) <= set("0123456789abcdef")


def test_fingerprint_is_stable_for_the_same_context():
    assert build_direction_fingerprint(DIRECTION_CONTEXT) == build_direction_fingerprint(
        dict(DIRECTION_CONTEXT)
    )


def test_fingerprint_ignores_key_order():
    reordered = {key: DIRECTION_CONTEXT[key] for key in reversed(list(DIRECTION_CONTEXT))}
    assert build_direction_fingerprint(reordered) == _fingerprint()


def test_fingerprint_ignores_reference_direction_order():
    reversed_directions = dict(DIRECTION_CONTEXT, referenceDirections=["南", "北西"])
    assert build_direction_fingerprint(reversed_directions) == _fingerprint()


def test_fingerprint_ignores_duplicate_reference_directions():
    duplicated = dict(DIRECTION_CONTEXT, referenceDirections=["南", "北西", "南"])
    assert build_direction_fingerprint(duplicated) == _fingerprint()


def test_fingerprint_ignores_target_date():
    """同一solar month内で targetDate が変わっても Compass direction は同じ。"""
    other_day = dict(DIRECTION_CONTEXT, targetDate="2026-09-20")
    assert build_direction_fingerprint(other_day) == _fingerprint()


def test_fingerprint_ignores_note_and_other_display_fields():
    noisy = dict(DIRECTION_CONTEXT, note="別の注記", displayLabel="表示用")
    assert build_direction_fingerprint(noisy) == _fingerprint()


@pytest.mark.parametrize("field", DIRECTION_FINGERPRINT_FIELDS)
def test_fingerprint_changes_when_a_fingerprint_field_changes(field):
    changed_values = {
        "referenceDirections": ["東"],
        "calculationMethod": "monthly_kyusei_v1",
        "solarMonthIndex": 9,
        "targetYear": 2027,
    }
    changed = dict(DIRECTION_CONTEXT, **{field: changed_values[field]})
    assert build_direction_fingerprint(changed) != _fingerprint()


def test_fingerprint_treats_missing_key_and_explicit_none_the_same():
    without_method = {
        key: value for key, value in DIRECTION_CONTEXT.items() if key != "calculationMethod"
    }
    explicit_none = dict(DIRECTION_CONTEXT, calculationMethod=None)
    assert build_direction_fingerprint(without_method) == build_direction_fingerprint(explicit_none)


def test_fingerprint_never_raises_for_missing_direction_context():
    assert build_direction_fingerprint(None) == build_direction_fingerprint({})


def test_fingerprint_is_stable_across_python_processes():
    """PYTHONHASHSEED を変えても同じ値になること（built-in hash() 不使用の担保）。"""
    backend_dir = Path(weekly_presentation.__file__).resolve().parents[2]
    script = (
        "import json,sys;"
        "from temples.domain.weekly_presentation import build_direction_fingerprint;"
        "print(build_direction_fingerprint(json.loads(sys.argv[1])))"
    )
    payload = json.dumps(DIRECTION_CONTEXT)
    outputs = set()
    for hash_seed in ("0", "1", "12345"):
        completed = subprocess.run(
            [sys.executable, "-c", script, payload],
            capture_output=True,
            text=True,
            check=True,
            cwd=backend_dir,
            env={"PYTHONHASHSEED": hash_seed, "PYTHONPATH": str(backend_dir)},
        )
        outputs.add(completed.stdout.strip())
    assert outputs == {_fingerprint()}


# --------------------------------------------------------------------------
# owner identity
# --------------------------------------------------------------------------


def test_owner_key_distinguishes_user_and_anonymous():
    assert build_weekly_owner_key(user_id=7) != build_weekly_owner_key(anonymous_id="7")


@pytest.mark.parametrize(
    "kwargs",
    [
        {},
        {"user_id": 1, "anonymous_id": "abc"},
        {"anonymous_id": "   "},
    ],
)
def test_owner_key_enforces_owner_xor(kwargs):
    with pytest.raises(ValueError):
        build_weekly_owner_key(**kwargs)


# --------------------------------------------------------------------------
# seeds
# --------------------------------------------------------------------------


def test_theme_seed_does_not_depend_on_owner():
    """Theme は Presentation Copy。Owner ごとに変えない。"""
    seed = build_weekly_theme_seed(
        week_start=WEEK_START,
        purpose=PURPOSE,
        direction_fingerprint=_fingerprint(),
        presentation_version=WEEKLY_PRESENTATION_VERSION,
    )
    assert "user" not in seed and "anon" not in seed


def test_theme_seed_and_featured_seed_never_collide():
    common = dict(
        week_start=WEEK_START,
        purpose=PURPOSE,
        direction_fingerprint=_fingerprint(),
        presentation_version=WEEKLY_PRESENTATION_VERSION,
    )
    assert build_weekly_theme_seed(**common) != build_weekly_featured_seed(owner_key="", **common)


def test_stable_index_rejects_non_positive_modulus():
    with pytest.raises(ValueError):
        stable_index("seed", 0)


# --------------------------------------------------------------------------
# candidate universe / pool
# --------------------------------------------------------------------------


def test_pool_is_capped_at_weekly_pool_limit():
    pool = build_weekly_pool(_recommendations(*range(1, 20)))
    assert pool == [1, 2, 3, 4, 5, 6]


def test_pool_preserves_recommendation_order():
    pool = build_weekly_pool(_recommendations(30, 10, 20))
    assert pool == [30, 10, 20]


def test_pool_falls_back_to_id_key_like_existing_recommendation_layer():
    pool = build_weekly_pool([{"id": 5}, {"shrine_id": 6}])
    assert pool == [5, 6]


def test_pool_drops_duplicates_keeping_first_occurrence():
    pool = build_weekly_pool(_recommendations(4, 4, 9))
    assert pool == [4, 9]


def test_pool_drops_entries_without_resolvable_shrine_id():
    pool = build_weekly_pool([{"name": "IDなし"}, None, "文字列", {"shrine_id": 11}])
    assert pool == [11]


def test_pool_is_empty_for_no_recommendations():
    assert build_weekly_pool(None) == []
    assert build_weekly_pool([]) == []


# Candidate Universe 契約:
#   「既存Recommendation結果そのものの上位 WEEKLY_POOL_LIMIT 件のみ」
# 上位6件を切り出した **後** にID解決・invalid除外・duplicate除外を行うため、
# 6件未満になっても7位以降からは補充されない。
SHRINE_A, SHRINE_B, SHRINE_C, SHRINE_D, SHRINE_E, SHRINE_F = 101, 102, 103, 104, 105, 106


def test_duplicate_within_top_six_shrinks_the_pool_without_pulling_in_rank_seven():
    """Recommendation 1:A 2:A 3:B 4:C 5:D 6:E 7:F -> Pool は A B C D E（Fは入らない）。"""
    recommendations = _recommendations(
        SHRINE_A,
        SHRINE_A,
        SHRINE_B,
        SHRINE_C,
        SHRINE_D,
        SHRINE_E,
        SHRINE_F,
    )
    pool = build_weekly_pool(recommendations)

    assert pool == [SHRINE_A, SHRINE_B, SHRINE_C, SHRINE_D, SHRINE_E]
    assert SHRINE_F not in pool
    assert len(pool) < WEEKLY_POOL_LIMIT


def test_invalid_id_within_top_six_is_not_backfilled_from_rank_seven_onward():
    recommendations = [
        {"shrine_id": SHRINE_A},
        {"name": "ID解決できないentry"},
        {"shrine_id": SHRINE_B},
        {"shrine_id": SHRINE_C},
        {"shrine_id": SHRINE_D},
        {"shrine_id": SHRINE_E},
        {"shrine_id": SHRINE_F},
    ]
    pool = build_weekly_pool(recommendations)

    assert pool == [SHRINE_A, SHRINE_B, SHRINE_C, SHRINE_D, SHRINE_E]
    assert SHRINE_F not in pool


@pytest.mark.parametrize(
    "seventh_entry",
    [
        {"shrine_id": SHRINE_F},
        {"id": SHRINE_F},
    ],
)
def test_rank_seven_never_changes_the_pool_whatever_its_id_key(seventh_entry):
    top_six = _recommendations(
        SHRINE_A, SHRINE_A, SHRINE_B, SHRINE_C, SHRINE_D, SHRINE_E
    )
    assert build_weekly_pool(top_six + [seventh_entry]) == build_weekly_pool(top_six)


def test_featured_selection_never_promotes_rank_seven_when_top_six_is_thin():
    """上位6件がduplicateで5件へ減っても、featuredへFが昇格しない。"""
    recommendations = _recommendations(
        SHRINE_A,
        SHRINE_A,
        SHRINE_B,
        SHRINE_C,
        SHRINE_D,
        SHRINE_E,
        SHRINE_F,
    )
    selected = _select(recommendations)

    assert len(selected) == WEEKLY_FEATURED_LIMIT
    assert SHRINE_F not in selected
    assert set(selected) <= {SHRINE_A, SHRINE_B, SHRINE_C, SHRINE_D, SHRINE_E}


# --------------------------------------------------------------------------
# featured selection
# --------------------------------------------------------------------------


def _select(recommendations, **overrides):
    kwargs = dict(
        recommendations=recommendations,
        owner_key=build_weekly_owner_key(user_id=42),
        week_start=WEEK_START,
        purpose=PURPOSE,
        direction_fingerprint=_fingerprint(),
        presentation_version=WEEKLY_PRESENTATION_VERSION,
    )
    kwargs.update(overrides)
    return select_featured_shrine_ids(**kwargs)


def test_selection_is_deterministic_for_identical_inputs():
    recommendations = _recommendations(1, 2, 3, 4, 5, 6)
    assert _select(recommendations) == _select(recommendations)


def test_selection_takes_at_most_three_from_the_top_six():
    selected = _select(_recommendations(*range(1, 13)))
    assert len(selected) == WEEKLY_FEATURED_LIMIT
    assert set(selected) <= {1, 2, 3, 4, 5, 6}


def test_selection_preserves_original_recommendation_order():
    ranked = [30, 10, 20, 50, 40, 60]
    selected = _select(_recommendations(*ranked))
    assert selected == [shrine_id for shrine_id in ranked if shrine_id in selected]


@pytest.mark.parametrize("candidate_count", [3, 4, 5])
def test_three_to_five_candidates_select_three_from_that_set(candidate_count):
    candidates = list(range(1, candidate_count + 1))
    selected = _select(_recommendations(*candidates))
    assert len(selected) == WEEKLY_FEATURED_LIMIT
    assert set(selected) <= set(candidates)


@pytest.mark.parametrize("candidate_count", [1, 2])
def test_one_or_two_candidates_return_all_of_them(candidate_count):
    candidates = list(range(1, candidate_count + 1))
    assert _select(_recommendations(*candidates)) == candidates


def test_zero_candidates_return_empty_without_backfill():
    assert _select([]) == []
    assert _select(None) == []


def test_selection_never_reaches_beyond_the_top_six_recommendations():
    """7位以降のShrineがfeaturedへ昇格しないこと（補充禁止）。"""
    selected = _select(_recommendations(*range(1, 21)))
    assert all(shrine_id <= WEEKLY_POOL_LIMIT for shrine_id in selected)


def test_selection_differs_by_owner():
    recommendations = _recommendations(1, 2, 3, 4, 5, 6)
    per_owner = {
        tuple(_select(recommendations, owner_key=build_weekly_owner_key(user_id=user_id)))
        for user_id in range(1, 30)
    }
    assert len(per_owner) > 1


def test_selection_differs_by_week_start():
    recommendations = _recommendations(1, 2, 3, 4, 5, 6)
    per_week = {
        tuple(_select(recommendations, week_start=date(2026, 9, 7).replace(day=day)))
        for day in (7, 14, 21, 28)
    }
    assert len(per_week) > 1


def test_selection_is_independent_of_recommendation_instance_identity():
    """recommendation_instance_id 相当の値はseedに入らないため結果を変えない。"""
    base = _recommendations(1, 2, 3, 4, 5, 6)
    with_instance_ids = [
        dict(entry, recommendation_instance_id=f"instance-{index}")
        for index, entry in enumerate(base)
    ]
    assert _select(with_instance_ids) == _select(base)
