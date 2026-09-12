"""Weekly Theme Catalog v1 のUnit Test。

Theme は Presentation Copy であり Recommendation Signal ではない。この
test file は Shrine も Recommendation も一切生成しない（DB不要）ことで、
その責務境界そのものを担保している。
"""

from __future__ import annotations

from datetime import date
from unittest.mock import patch

import pytest

from temples.domain.need_tags import NEED_TAGS
from temples.domain.weekly_presentation import (
    WEEKLY_PRESENTATION_VERSION,
    build_direction_fingerprint,
)
from temples.domain.weekly_theme_catalog_v1 import (
    THEME_KEY_FIELD,
    THEME_MESSAGE_FIELD,
    THEME_TITLE_FIELD,
    WEEKLY_FALLBACK_THEME,
    WEEKLY_THEME_CATALOG_V1,
    get_fallback_theme,
    known_purposes,
    select_weekly_theme,
)

WEEK_START = date(2026, 9, 7)
DIRECTION_CONTEXT = {
    "targetYear": 2026,
    "solarMonthIndex": 8,
    "referenceDirections": ["北西"],
    "calculationMethod": "annual_monthly_kyusei_v1",
}
FINGERPRINT = build_direction_fingerprint(DIRECTION_CONTEXT)

REQUIRED_THEME_FIELDS = (THEME_KEY_FIELD, THEME_TITLE_FIELD, THEME_MESSAGE_FIELD)


def _select(**overrides):
    kwargs = dict(
        purpose="career",
        direction_fingerprint=FINGERPRINT,
        week_start=WEEK_START,
        presentation_version=WEEKLY_PRESENTATION_VERSION,
    )
    kwargs.update(overrides)
    return select_weekly_theme(**kwargs)


# --------------------------------------------------------------------------
# catalog structure
# --------------------------------------------------------------------------


def test_catalog_covers_exactly_the_existing_purpose_authority():
    """purposeの正本は NEED_TAGS。catalog独自のpurposeを新設していないこと。"""
    assert set(WEEKLY_THEME_CATALOG_V1) == set(NEED_TAGS)
    assert known_purposes() == tuple(NEED_TAGS)


@pytest.mark.parametrize("purpose", sorted(WEEKLY_THEME_CATALOG_V1))
def test_every_catalog_theme_has_the_required_structure(purpose):
    themes = WEEKLY_THEME_CATALOG_V1[purpose]
    assert themes, f"{purpose} has no theme candidate"
    for theme in themes:
        assert set(theme) == set(REQUIRED_THEME_FIELDS)
        for field in REQUIRED_THEME_FIELDS:
            assert isinstance(theme[field], str) and theme[field].strip()


def test_theme_keys_are_globally_unique():
    keys = [
        theme[THEME_KEY_FIELD]
        for themes in WEEKLY_THEME_CATALOG_V1.values()
        for theme in themes
    ]
    assert len(keys) == len(set(keys))
    assert WEEKLY_FALLBACK_THEME[THEME_KEY_FIELD] not in keys


def test_catalog_copy_never_references_directions():
    """方位からKAMI MUSUBI独自の象徴意味を作らない（copyに方位語を含めない）。"""
    direction_words = ["北", "南", "東", "西", "方位", "方角"]
    for themes in WEEKLY_THEME_CATALOG_V1.values():
        for theme in themes:
            text = f"{theme[THEME_TITLE_FIELD]}{theme[THEME_MESSAGE_FIELD]}"
            assert not any(word in text for word in direction_words), theme


# --------------------------------------------------------------------------
# determinism
# --------------------------------------------------------------------------


def test_same_inputs_always_return_the_same_theme():
    assert _select() == _select()


@pytest.mark.parametrize("purpose", sorted(WEEKLY_THEME_CATALOG_V1))
def test_selected_theme_belongs_to_that_purpose_catalog(purpose):
    selected = _select(purpose=purpose)
    assert selected in [dict(theme) for theme in WEEKLY_THEME_CATALOG_V1[purpose]]


def test_theme_changes_across_weeks_for_the_same_purpose():
    per_week = {
        _select(week_start=WEEK_START.replace(day=day))[THEME_KEY_FIELD]
        for day in (7, 14, 21, 28)
    }
    assert len(per_week) > 1


def test_theme_selection_uses_no_runtime_random():
    """`random` を触っていたらここで壊れる（patchした関数は呼ばれない）。"""
    with patch("random.Random.random", side_effect=AssertionError("random used")):
        assert _select() == _select()


def test_returned_theme_is_a_copy_and_cannot_mutate_the_catalog():
    selected = _select()
    selected[THEME_MESSAGE_FIELD] = "書き換え"
    assert _select()[THEME_MESSAGE_FIELD] != "書き換え"


def test_presentation_version_participates_in_selection():
    keys = {
        _select(presentation_version=version)[THEME_KEY_FIELD]
        for version in ("weekly_presentation_v1", "weekly_presentation_v2", "x", "y")
    }
    assert len(keys) > 1


# --------------------------------------------------------------------------
# fallback
# --------------------------------------------------------------------------


def test_unknown_purpose_falls_back_instead_of_raising():
    assert _select(purpose="not_a_purpose") == dict(WEEKLY_FALLBACK_THEME)


@pytest.mark.parametrize("purpose", [None, "", "   "])
def test_missing_purpose_falls_back(purpose):
    assert _select(purpose=purpose) == dict(WEEKLY_FALLBACK_THEME)


def test_unexpected_failure_falls_back_instead_of_propagating():
    """Theme failure が Recommendation / API 全体の failure にならないこと。"""
    with patch(
        "temples.domain.weekly_theme_catalog_v1.stable_index",
        side_effect=RuntimeError("boom"),
    ):
        assert _select() == dict(WEEKLY_FALLBACK_THEME)


def test_fallback_theme_has_the_required_structure():
    assert set(WEEKLY_FALLBACK_THEME) == set(REQUIRED_THEME_FIELDS)
    assert WEEKLY_FALLBACK_THEME[THEME_KEY_FIELD] == "weekly_default"
    assert WEEKLY_FALLBACK_THEME[THEME_TITLE_FIELD] == "今週のテーマ"
    assert WEEKLY_FALLBACK_THEME[THEME_MESSAGE_FIELD].strip()


def test_fallback_theme_is_returned_as_a_copy():
    fallback = get_fallback_theme()
    fallback[THEME_MESSAGE_FIELD] = "書き換え"
    assert get_fallback_theme()[THEME_MESSAGE_FIELD] != "書き換え"
