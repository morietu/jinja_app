# backend/temples/domain/wish_map.py
from functools import lru_cache
from pathlib import Path

import yaml


@lru_cache(maxsize=1)
def load_wish_map() -> dict:
    path = Path(__file__).resolve().parent.parent / "data" / "wish_map.yaml"
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def match_wish_from_query(query: str) -> str | None:
    """ユーザーのqueryから該当する願意キーを返す"""
    if not query:
        return None
    q = query.strip()
    data = load_wish_map()
    for key, meta in data.items():
        if key in q:
            return key
        for syn in meta.get("synonyms", []):
            if syn in q:
                return key
    return None


def get_hints_for_wish(wish: str) -> list[str]:
    """願意に対応する推し文候補を返す"""
    data = load_wish_map()
    return data.get(wish, {}).get("hints", [])


def get_deities_for_wish(wish: str) -> list[str]:
    """願意に対応する神格（御祭神）を返す"""
    data = load_wish_map()
    return data.get(wish, {}).get("deities", [])
