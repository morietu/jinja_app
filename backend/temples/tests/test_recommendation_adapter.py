import types
import pytest
from temples.services.recommendation import recommend_shrines


def _mk_obj(id: int, base_score: float, luck_bonus_flag: bool):
    # QuerySet の要素っぽい匿名オブジェクトを作る
    return types.SimpleNamespace(id=id, base_score=base_score, luck_bonus_flag=luck_bonus_flag)


def test_recommend_shrines_applies_bonus_and_orders(settings):
    settings.ENABLE_LUCK_BONUS = True
    settings.LUCK_BONUS_POINT = 10.0

    qs_like = [
        _mk_obj(1, 50, False),
        _mk_obj(2, 45, True),  # +10 => 55
        _mk_obj(3, 60, False),
    ]
    ids_scores = recommend_shrines(qs_like)
    assert ids_scores == [(3, 60.0), (2, 55.0), (1, 50.0)]


def test_recommend_shrines_disable_bonus(settings):
    settings.ENABLE_LUCK_BONUS = False
    settings.LUCK_BONUS_POINT = 10.0

    qs_like = [
        _mk_obj(1, 50, False),
        _mk_obj(2, 45, True),  # ただしボーナス無効
        _mk_obj(3, 60, False),
    ]
    ids_scores = recommend_shrines(qs_like)
    assert ids_scores == [(3, 60.0), (1, 50.0), (2, 45.0)]
