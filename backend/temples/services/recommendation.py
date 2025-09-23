# backend/temples/services/recommendation.py
from __future__ import annotations

from typing import List, Tuple

from django.conf import settings
from django.db.models import QuerySet


def recommend_shrines(
    qs: QuerySet,
    *,
    enable_luck_bonus: bool | None = None,
    base_field: str | None = None,
    element_for_bonus: str | None = None,
    bonus_point: float | None = None,
) -> List[Tuple[int, float]]:
    """
    Shrine QuerySet から (id, score) のリストを返す。
    - score は base_field をベースに、条件一致でボーナスを加点
    - 返値は score 降順、同点時 id 昇順で安定ソート
    """
    # 設定値のデフォルトを安全に参照（env は使わない）
    enable = (
        enable_luck_bonus
        if enable_luck_bonus is not None
        else getattr(settings, "ENABLE_LUCK_BONUS", True)
    )
    base = base_field or getattr(settings, "LUCK_BASE_FIELD", "popular_score")
    bonus_elem = element_for_bonus or getattr(settings, "LUCK_BONUS_ELEMENT", "金運")
    bonus = float(
        bonus_point if bonus_point is not None else getattr(settings, "LUCK_BONUS_POINT", 10.0)
    )

    # 必要なフィールドだけ取り出す
    rows = qs.values_list("id", base, "element")

    scored: List[Tuple[int, float]] = []
    for shrine_id, base_score, element in rows:
        score = float(base_score or 0.0)
        if enable and (str(element or "") == str(bonus_elem)):
            score += bonus
        scored.append((int(shrine_id), score))

    # 降順（score）、同点は id 昇順で安定化
    scored.sort(key=lambda t: (-t[1], t[0]))
    return scored
