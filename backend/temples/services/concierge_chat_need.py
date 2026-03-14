from __future__ import annotations

from collections import Counter
from typing import Any, Dict, List


NEED_SYNONYMS: Dict[str, List[str]] = {
    "study": [
        "学業", "学業成就", "合格", "合格祈願",
        "試験", "資格試験", "受験", "勉強", "入試",
    ],
    "career": [
        "仕事運", "転職", "出世", "昇進", "勝運",
        "導き", "挑戦", "後押し", "道を開く",
    ],
    "mental": [
        "不安", "悩み", "つらい", "苦しい", "しんどい",
        "落ち込む", "落ち込み", "怖い", "心配", "迷い",
        "モヤモヤ", "気持ち", "心", "整えたい", "浄化",
        "厄", "厄除け", "厄払い",
    ],
    "love": [
        "恋愛", "恋", "縁結び", "良縁", "結婚",
        "復縁", "片思い", "両思い",
        "夫婦", "パートナー", "出会い", "ご縁",
    ],
    "money": [
        "金運", "お金", "収入", "売上",
        "商売繁盛", "財運", "裕福", "貯金",
        "経済", "資産", "稼ぎたい",
    ],
    "rest": [
        "休みたい", "休息", "疲れた", "疲れて",
        "疲労", "癒し", "静か", "落ち着きたい",
        "落ち着く", "穏やか", "ひと息",
        "整えたい", "リセット", "気分転換",
    ],
}


NEED_PRIORITY = {
    "study": 0,
    "career": 1,
    "mental": 2,
    "love": 3,
    "money": 4,
    "rest": 5,
}


NEED_TAG_ALIASES: Dict[str, str] = {
    "marriage": "love",
    "romance": "love",
    "relationship": "love",
    "anxiety": "mental",
    "healing": "rest",
    "career_change": "career",
    "work": "career",
    "fortune": "money",
    "courage": "career",
    "challenge": "career",
    "ambition": "career",
    "success": "career",
}


def normalize_need_tag(tag: Any) -> str:
    s = str(tag or "").strip().lower()
    return NEED_TAG_ALIASES.get(s, s)


def normalize_need_tags(tags: Any, *, max_tags: int = 3) -> List[str]:
    normalized: List[str] = []

    for t in tags or []:
        if not isinstance(t, str) or not t.strip():
            continue

        nt = normalize_need_tag(t)
        if nt and nt not in normalized:
            normalized.append(nt)

    return normalized[:max_tags]


def _normalize_need_hits(raw_hits: Any) -> Dict[str, List[str]]:
    cleaned_hits: Dict[str, List[str]] = {}

    if not isinstance(raw_hits, dict):
        return cleaned_hits

    for k, v in raw_hits.items():
        if not isinstance(k, str):
            continue

        key = normalize_need_tag(k)
        if not key:
            continue

        values: List[str] = []

        if isinstance(v, list):
            for x in v:
                s = str(x).strip()
                if s and s not in values:
                    values.append(s)
        elif v is not None:
            s = str(v).strip()
            if s:
                values.append(s)

        if values:
            cleaned_hits[key] = values

    return cleaned_hits


def _build_need_payload_from_domain_extract(
    extracted: Any,
    *,
    max_tags: int = 3,
) -> Dict[str, Any]:
    raw_tags = getattr(extracted, "tags", []) or []
    raw_hits = getattr(extracted, "hits", {}) or {}

    return {
        "tags": normalize_need_tags(raw_tags, max_tags=max_tags),
        "hits": _normalize_need_hits(raw_hits),
    }


def extract_need_fallback(query: str, *, max_tags: int = 3) -> Dict[str, Any]:
    text = str(query or "").strip()

    if not text:
        return {"tags": [], "hits": {}}

    counter: Counter[str] = Counter()
    hits: Dict[str, List[str]] = {}

    for tag, words in NEED_SYNONYMS.items():
        matched_words: List[str] = []

        for w in words:
            if w and w in text:
                matched_words.append(w)
                counter[tag] += 1

        if matched_words:
            uniq: List[str] = []
            seen = set()

            for w in matched_words:
                if w not in seen:
                    uniq.append(w)
                    seen.add(w)

            hits[tag] = uniq

    tags = sorted(
        counter.keys(),
        key=lambda t: (-counter[t], NEED_PRIORITY.get(t, 99), t),
    )[:max_tags]

    return {
        "tags": tags,
        "hits": hits,
    }


def resolve_need_payload(
    *,
    query: str,
    need_tags: Any = None,
    max_tags: int = 3,
) -> Dict[str, Any]:
    if need_tags:
        return {
            "tags": normalize_need_tags(need_tags, max_tags=max_tags),
            "hits": {},
        }

    try:
        from temples.domain.need_tags import extract_need_tags  # type: ignore

        extracted = extract_need_tags(query, max_tags=max_tags)
        payload = _build_need_payload_from_domain_extract(
            extracted,
            max_tags=max_tags,
        )
    except Exception:
        payload = extract_need_fallback(query, max_tags=max_tags)
        payload["tags"] = normalize_need_tags(
            payload.get("tags", []),
            max_tags=max_tags,
        )
        payload["hits"] = _normalize_need_hits(payload.get("hits", {}))

    return payload


__all__ = [
    "normalize_need_tag",
    "normalize_need_tags",
    "extract_need_fallback",
    "resolve_need_payload",
]
