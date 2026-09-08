import pytest

from temples.services.concierge_chat_ranking import (
	PROFILE_SIGNAL_MAX,
	_score_profile_signal,
)


def test_worship_style_alone_does_not_score_matching_shrine_text():
	rec = {
		"goriyaku": "静かな境内で心願成就",
		"description": "落ち着いて参拝できる神社",
		"visit_style_tags": ["quiet"],
		"astro_elements": [],
	}
	profile_context = {"user_profile": {"worshipStyle": "静かな"}}

	score, matched = _score_profile_signal(rec, profile_context)

	assert score == 0.0
	assert matched == []


def test_gogyo_match_scores_and_records_match():
	rec = {"astro_elements": ["木"]}
	profile_context = {"derived_profile": {"gogyo": "木"}}

	score, matched = _score_profile_signal(rec, profile_context)

	assert score == pytest.approx(0.02)
	assert matched == ["gogyo:木"]


def test_gogyo_match_is_not_increased_by_worship_style_match():
	rec = {
		"goriyaku": "静かな境内",
		"description": "静かに参拝できる神社",
		"visit_style_tags": [],
		"astro_elements": ["木"],
	}
	profile_context = {
		"derived_profile": {"gogyo": "木"},
		"user_profile": {"worshipStyle": "静か"},
	}

	score, matched = _score_profile_signal(rec, profile_context)

	assert score == pytest.approx(0.02)
	assert matched == ["gogyo:木"]


def test_profile_signal_max_is_point_zero_two():
	assert PROFILE_SIGNAL_MAX == 0.02
