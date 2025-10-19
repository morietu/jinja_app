# backend/temples/tests/test_domain_match.py
import math
import pytest
from backend.temples.domain.match import bonus_score


def test_empty_tags_returns_zero():
    assert bonus_score([], wish="縁結び", gogyou="木") == 0.0


def test_wish_synonym_hit_adds_3():
    # "縁結び" の同義語「恋愛」にヒット → +3
    assert bonus_score(["恋愛"], wish="縁結び", gogyou=None) == 3.0


def test_gogyou_hit_adds_1():
    # 五行トークン「木」がタグ中に含まれる → +1
    assert bonus_score(["木属性", "その他"], wish=None, gogyou="木") == 1.0


def test_deity_bonus_applies_by_wish_table():
    # 学業成就 × 天満宮(=1.5) → +1.5
    got = bonus_score(["合格祈願", "天満宮"], wish="学業成就", gogyou=None)
    assert math.isclose(got, 1.5, rel_tol=0, abs_tol=1e-9)


def test_combined_synonym_gogyou_deity():
    # 同義語「恋愛」→ 縁結び(+3) + 五行「木」(+1) + 縁結び×大国主(=2.0) → 6.0
    tags = ["恋愛", "大国主", "木の加護"]
    got = bonus_score(tags, wish="縁結び", gogyou="木")
    assert math.isclose(got, 6.0, rel_tol=0, abs_tol=1e-9)
