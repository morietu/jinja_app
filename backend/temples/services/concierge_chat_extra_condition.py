from __future__ import annotations

from typing import Dict, Optional, Set

from temples.domain.extra_condition_tags import extract_extra_tags, split_tags_by_kind


def resolve_extra_condition_tags(
    extra_condition: Optional[str],
) -> Dict[str, Set[str]]:
    sort_tags: Set[str] = set()
    hard_filter_tags: Set[str] = set()
    soft_signal_tags: Set[str] = set()

    try:
        ex = extract_extra_tags(extra_condition or "", max_tags=3)
        kinds = split_tags_by_kind(ex.tags)
        sort_tags = set(kinds.get("sort_override") or [])
        hard_filter_tags = set(kinds.get("hard_filter") or [])
        soft_signal_tags = set(kinds.get("soft_signal") or [])
    except Exception:
        sort_tags = set()
        hard_filter_tags = set()
        soft_signal_tags = set()

    return {
        "sort_tags": sort_tags,
        "hard_filter_tags": hard_filter_tags,
        "soft_signal_tags": soft_signal_tags,
    }
