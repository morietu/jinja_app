# backend/temples/services/shrine_rules.py
from __future__ import annotations

SHRINE_POSITIVE = [
    "神社", "神宮",
    "稲荷", "八幡", "天神", "熊野",
    "白山", "諏訪", "春日", "氷川", "八坂", "住吉", "日枝",
    "金刀比羅", "琴平", "鹿島", "香取",
    "三峯", "三峰", "浅間", "厳島", "愛宕", "貴船",
    "大國魂", "大国魂",
]
SHRINE_NEGATIVE = [
    "寺", "院", "堂", "大師", "観音", "地蔵", "阿弥陀", "寺院",
    "教会", "チャペル", "モスク",
]

def is_shrine_like(place: dict) -> bool:
    name = place.get("name") or ""
    addr = place.get("address") or ""
    text = f"{name}{addr}"

    if any(ng in text for ng in SHRINE_NEGATIVE):
        return False

    types = set(place.get("types") or [])
    if "shinto_shrine" in types:
        return True

    return any(ok in text for ok in SHRINE_POSITIVE)

def prefer_explicit_jinja(place: dict) -> bool:
    name = place.get("name") or ""
    addr = place.get("address") or ""
    t = f"{name}{addr}"
    return ("神社" in t) or ("神宮" in t)
