# backend/temples/domain/match.py
from __future__ import annotations

from typing import Iterable, Optional

# ユーザーの「願いごと」→ 代表的なキーワード集合（どれかヒットで加点）
WISH_SYNONYMS = {
    "縁結び": {"縁結び", "恋愛", "良縁", "結婚"},
    "学業": {"学業", "合格", "合格祈願", "合格祈念", "学問", "試験"},
    "仕事": {"仕事", "出世", "商売繁盛", "就職", "転職", "開運"},
    "金運": {"金運", "財運", "商売繁盛", "くじ", "宝くじ"},
    "健康": {"健康", "無病息災", "病気平癒", "厄除け", "安産"},
}

# 五行そのものがタグに含まれていたら軽く加点（将来は神格や方位と相性で拡張可）
GOGYOU_TOKENS = {"木", "火", "土", "金", "水"}


def _norm(s: Optional[str]) -> str:
    return (s or "").strip()


def _as_set(xs: Iterable[str] | None) -> set[str]:
    return {_norm(x) for x in (xs or []) if _norm(x)}


def bonus_score(tags: Iterable[str] | None, wish: Optional[str], gogyou: Optional[str]) -> float:
    """
    ・願いごとがタグ（または同義語）にマッチで +3
    ・五行がタグに含まれていれば +1
    - どれも任意。与えられなければ 0 点。
    """
    tset = _as_set(tags)
    if not tset:
        return 0.0

    score = 0.0

    w = _norm(wish)
    if w:
        syns = WISH_SYNONYMS.get(w) or {w}
        if tset.intersection(syns):
            score += 3.0

    g = _norm(gogyou)
    if g and g in GOGYOU_TOKENS and any(g in t for t in tset):
        score += 1.0

    return score
