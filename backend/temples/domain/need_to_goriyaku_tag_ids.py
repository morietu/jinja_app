# backend/temples/domain/need_to_goriyaku_tag_ids.py
from __future__ import annotations

from typing import Iterable, Set, Dict

# need_tag -> goriyaku_tag_ids
# TODO: ここにDBのgoriyaku tag idを入れていく（未確定は空でOK）
NEED_TO_GORIYAKU_IDS: Dict[str, Set[int]] = {
    "love": set(),
    "relationship": set(),
    "marriage": set(),
    "communication": set(),
    "career": set(),
    "money": set(),
    "study": set(),
    "health": set(),
    "mental": set(),
    "protection": {2},
    "courage": set(),
    "focus": set(),
    "rest": set(),
    "family": set(),
    "travel_safe": set(),
}

def need_tags_to_goriyaku_ids(tags: Iterable[str]) -> Set[int]:
    """
    need_tags(list[str]) を goriyaku_tag_ids(set[int]) に変換する。
    未定義タグは無視。未割当は空セット。
    """
    out: Set[int] = set()
    for t in tags or []:
        key = str(t).strip()
        if not key:
            continue
        out |= NEED_TO_GORIYAKU_IDS.get(key, set())
    return out
