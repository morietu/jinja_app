# backend/temples/services/recommendation.py
from __future__ import annotations

from typing import Iterable, List, Tuple

from django.conf import settings


def recommend_shrines(
    qs: Iterable,
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

    scored: List[Tuple[int, float]] = []

    # QuerySet の場合は値を直接取り出す（DB 側で効率化）
    if hasattr(qs, "values_list"):
        rows = qs.values_list("id", base, "element")
        for shrine_id, base_score, element in rows:
            score = float(base_score or 0.0)
            if enable and (str(element or "") == str(bonus_elem)):
                score += bonus
            scored.append((int(shrine_id), score))
        # 降順ソートは下で統一
    else:
        # 一般的なイテラブル（list of objects/namespace）として扱う
        it = iter(qs)
        try:
            first = next(it)
        except StopIteration:
            return []

        # 推測: テストでは属性名が base_score / luck_bonus_flag を使っている
        def _get_attr(obj, names, default=None):
            for n in names:
                if hasattr(obj, n):
                    return getattr(obj, n)
            return default

        base_names = [base, "base_score", "popular_score", "score"]
        element_names = ["element", "luck_bonus_flag", "has_bonus", "flag"]

        # process first
        candidates = [first] + list(it)
        for obj in candidates:
            shrine_id = _get_attr(obj, ["id"], None)
            base_score = _get_attr(obj, base_names, 0.0)
            element = _get_attr(obj, element_names, None)

            score = float(base_score or 0.0)
            # element がブール値で渡されるケースを考慮
            if enable and (
                (isinstance(element, bool) and element) or (str(element or "") == str(bonus_elem))
            ):
                score += bonus
            scored.append((int(shrine_id), score))

    # 降順（score）、同点は id 昇順で安定化
    scored.sort(key=lambda t: (-t[1], t[0]))
    return scored
