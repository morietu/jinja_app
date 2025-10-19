# backend/temples/tests/test_match_unit.py

import math
import pytest

from backend.temples.domain.match import bonus_score


def test_empty_tags_returns_zero():
    assert bonus_score([], wish="金運", gogyou="金") == 0.0
    assert bonus_score(None, wish="縁結び", gogyou="木") == 0.0


def test_synonym_hit_adds_3():
    # 縁結びの同義語「恋愛」で +3
    assert bonus_score(tags=["恋愛"], wish="縁結び", gogyou=None) == 3.0


def test_gogyou_hit_adds_1_when_token_present_in_any_tag():
    # 五行「金」トークンがタグ「金運」に含まれる → +1
    assert bonus_score(tags=["金運"], wish=None, gogyou="金") == 1.0


def test_deity_weight_applies_when_wish_has_table():
    # 商売繁盛×恵比寿 → ウェイト 2.0（同義語や五行は加点しない）
    assert math.isclose(bonus_score(tags=["恵比寿さま"], wish="商売繁盛", gogyou=None), 2.0)


def test_full_combo_synonym_gogyou_deity():
    # 金運：同義語ヒット(+3) + 五行「金」(+1) + 弁財天(+1.5) = 5.5
    score = bonus_score(tags=["金運", "弁財天"], wish="金運", gogyou="金")
    assert math.isclose(score, 5.5)


def test_unknown_wish_no_deity_weight_no_synonym():
    # 未知の願い：同義語/ウェイトなし → 0（タグに神名があっても加点されない）
    assert bonus_score(tags=["毘沙門天"], wish="未知", gogyou=None) == 0.0
