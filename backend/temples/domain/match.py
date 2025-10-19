from __future__ import annotations

from typing import Iterable, Optional

# 願いごとの同義語（どれかヒットで加点）
WISH_SYNONYMS = {
    "縁結び": {"縁結び", "恋愛", "良縁", "結婚"},
    "学業": {"学業", "合格", "合格祈願", "合格祈念", "学問", "試験"},
    "仕事": {"仕事", "出世", "商売繁盛", "就職", "転職", "開運"},
    "金運": {"金運", "財運", "商売繁盛", "くじ", "宝くじ"},
    "健康": {"健康", "無病息災", "病気平癒", "厄除け", "安産"},
}

# 五行トークン
GOGYOU_TOKENS = {"木", "火", "土", "金", "水"}


def _norm(s: Optional[str]) -> str:
    return (s or "").strip()


def _as_set(xs: Iterable[str] | None) -> set[str]:
    return {_norm(x) for x in (xs or []) if _norm(x)}


# 願いごと別の御祭神ウェイト
_WISH_DEITY_WEIGHTS = {
    "学業成就": {"菅原道真": 2.0, "天満宮": 1.5, "天神": 1.5},
    "商売繁盛": {"恵比寿": 2.0, "大黒天": 2.0, "えびす": 1.5, "だいこく": 1.5},
    "縁結び": {"大国主": 2.0, "大国主命": 2.0, "大国主大神": 2.0, "木花咲耶姫": 1.5, "磐長姫": 1.0},
    "金運": {"毘沙門天": 1.5, "弁財天": 1.5, "大黒天": 1.5},
}


def _deity_bonus(tags: set[str], wish: str) -> float:
    wish = (wish or "").strip()
    weights = _WISH_DEITY_WEIGHTS.get(wish)
    if not weights:
        return 0.0
    return sum(w for key, w in weights.items() if any(key in t for t in tags))


def bonus_score(tags: Iterable[str] | None, wish: Optional[str], gogyou: Optional[str]) -> float:
    """
    総合ボーナス:
      - 願いごとの同義語ヒット  : +3
      - 五行タグヒット          : +1
      - 御祭神の相性ウェイト     : 既定表に基づき加点
    """
    tset = _as_set(tags)
    if not tset:
        return 0.0

    score = 0.0

    # 1) 願いごと（同義語含む）
    w = _norm(wish)
    if w:
        syns = WISH_SYNONYMS.get(w) or {w}
        if tset.intersection(syns):
            score += 3.0

    # 2) 五行
    g = _norm(gogyou)
    if g and g in GOGYOU_TOKENS and any(g in t for t in tset):
        score += 1.0

    # 3) 御祭神との相性
    score += _deity_bonus(tset, w)

    return score


compute_match = bonus_score
__all__ = ["bonus_score", "compute_match"]
