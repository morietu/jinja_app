# temples/api/schema_hooks.py
from __future__ import annotations

from typing import Any

EXCLUDE_PREFIXES = (
    "/api/my/goshuin",  # 単数互換
    "/api/concierge/chat",  # no-slash互換（必要なら）
    "/api/concierge-threads",  # no-slash互換を残してるなら
)


def _is_compat_no_slash_path(path: str) -> bool:
    return any(path.startswith(prefix) and not path.endswith("/") for prefix in EXCLUDE_PREFIXES)


def preprocess_exclude_compat_paths(endpoints: list[tuple[Any, ...]], **kwargs):
    """
    drf-spectacular PREPROCESSING_HOOKS で呼ばれる endpoints を対象に、
    末尾スラッシュ無しの互換パスだけを除外する。
    """
    filtered = []
    for endpoint in endpoints:
        path = endpoint[0] if endpoint else ""
        if isinstance(path, str) and _is_compat_no_slash_path(path):
            continue
        filtered.append(endpoint)
    return filtered
