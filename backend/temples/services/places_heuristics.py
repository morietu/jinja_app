# -*- coding: utf-8 -*-
from __future__ import annotations

import re
import unicodedata
from typing import Dict, Optional, Any


def norm_name(s: Optional[str]) -> str:
    """
    日本語名の簡易正規化（NFKC→小文字→記号/空白除去）。
    - ここは辞書と判定の共通基盤なので、なるべく変更しない
    """
    if not s:
        return ""
    s = unicodedata.normalize("NFKC", str(s)).casefold()
    s = re.sub(r"[ \u3000\-\.\,，。/／\(\)（）「」『』【】\[\]~～・]+", "", s)
    return s


# ---- shrine/temple name heuristics ---------------------------------

NEGATIVE_TOKENS_RAW = {
    "寺", "院", "大師", "観音", "不動", "阿弥陀", "地蔵", "如来", "菩薩",
    "禅", "霊場", "本山", "僧",
    "天台", "真言", "浄土", "曹洞", "臨済", "日蓮",
}

POSITIVE_TOKENS_RAW = {
    "神社", "神宮", "大社", "天満宮", "八幡", "稲荷", "白山", "熊野", "住吉", "諏訪",
    "日枝", "氷川", "明神",
    # "権現",  # 寺にも混ざるので様子見推奨
}

TOKEN_SHRINE = norm_name("神社")

# import時に1回だけ正規化して固定（不変にして事故防止）
NEGATIVE_TOKENS = frozenset(norm_name(t) for t in NEGATIVE_TOKENS_RAW)
POSITIVE_TOKENS = frozenset(norm_name(t) for t in POSITIVE_TOKENS_RAW)


def looks_buddhist_by_name(name: str) -> bool:
    n = norm_name(name)
    return any(t in n for t in NEGATIVE_TOKENS)


def looks_shinto_by_name(name: str) -> bool:
    n = norm_name(name)
    if TOKEN_SHRINE in n:
        return True
    # 「神社」以外の神社シグナル
    return any(t in n for t in POSITIVE_TOKENS if t != TOKEN_SHRINE)


def is_shinto_candidate(row: Dict[str, Any]) -> bool:
    """
    Placesの1行(row)が「神社として扱ってよいか」の最終判定。
    優先順位：
      1) 寺を混ぜない（types / nameネガ）
      2) types が shinto_shrine なら強採用（ただし過信はしない）
      3) 名前救済（地方用、複合語）
    """
    types = set(row.get("types") or [])
    name = row.get("name") or ""

    # 1) 寺の安全弁
    if "buddhist_temple" in types:
        return False
    if looks_buddhist_by_name(name):
        return False

    # 2) types を最大限使う
    if "shinto_shrine" in types:
        return True

    # 3) 地方救済（名前）
    return looks_shinto_by_name(name)
