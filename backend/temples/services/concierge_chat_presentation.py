from __future__ import annotations

from typing import Any, Dict, Optional

from temples.llm import backfill as bf


NEED_REASON_LABELS: Dict[str, str] = {
    "study": "学業や合格を願う参拝に",
    "career": "仕事や転機に向き合う参拝に",
    "mental": "不安・心に向き合う参拝に",
    "love": "ご縁や恋愛を願う参拝に",
    "money": "金運や商売繁盛を願う参拝に",
    "rest": "心身を休めたいときの参拝に",
    "courage": "流れを変えたい時や一歩踏み出したい時の参拝に",
    "focus": "習慣や集中を整えたい時の参拝に",
    "protection": "厄除けや身を守りたい願いの参拝に",
}

SOFT_SIGNAL_HIGHLIGHTS: Dict[str, str] = {
    "calm": "落ち着いて気持ちを整えやすい雰囲気",
}


def _build_reason_from_matched_need_tags(matched: list[str]) -> str:
    tags = [str(x).strip() for x in matched if str(x).strip()]
    tag_set = set(tags)

    if "career" in tag_set and "mental" in tag_set and "courage" in tag_set:
        return "転機への不安を整えながら、一歩踏み出したい時の参拝に"

    if "money" in tag_set and "courage" in tag_set:
        return "金運を整えつつ、行動のきっかけを得たい時の参拝に"

    if "mental" in tag_set and "rest" in tag_set:
        return "疲れた気持ちを整え、落ち着いて休息したい時の参拝に"

    if "career" in tag_set and "courage" in tag_set:
        return "仕事や転機に向き合いながら、前へ進みたい時の参拝に"

    if "mental" in tag_set and "courage" in tag_set:
        return "不安を整えながら、前向きに進みたい時の参拝に"

    if tags:
        return NEED_REASON_LABELS.get(tags[0], "相談内容に合うご利益・特徴があります。")

    return "相談内容に合うご利益・特徴があります。"


def _apply_soft_signal_highlights(
    rec: Dict[str, Any],
    *,
    soft_signal_tags: set[str],
) -> None:
    """
    soft_signal_tags に応じて highlights を補強する。
    rec を破壊的に更新する。
    """
    if not isinstance(rec, dict):
        return

    highlights = rec.get("highlights") or []
    if not isinstance(highlights, list):
        highlights = []

    normalized = [
        str(x).strip()
        for x in highlights
        if isinstance(x, str) and str(x).strip()
    ]

    for tag in soft_signal_tags:
        label = SOFT_SIGNAL_HIGHLIGHTS.get(tag)
        if label and label not in normalized:
            normalized.append(label)

    rec["highlights"] = normalized[:3]


def _attach_reason_source(rec: Dict[str, Any]) -> None:
    """
    breakdown / 既存 reason / highlights を見て、
    API返却用の reason / reason_source / bullets を整える。
    rec を破壊的に更新する。
    """
    if not isinstance(rec, dict):
        return

    matched = ((rec.get("breakdown") or {}).get("matched_need_tags") or [])
    matched = [str(x).strip() for x in matched if str(x).strip()]

    highlights = rec.get("highlights") or []
    if not isinstance(highlights, list):
        highlights = []

    bullets = [
        str(x).strip()
        for x in highlights
        if isinstance(x, str) and str(x).strip()
    ][:2]

    if matched:
        reason = _build_reason_from_matched_need_tags(matched)
        reason_source = "reason:matched_need_tags"
    else:
        raw_reason = str(rec.get("reason") or "").strip()
        if raw_reason:
            reason = "この神社ならではの特徴があります。"
            reason_source = "reason:normalized_original"
        else:
            reason = "相談内容に合うご利益・特徴があります。"
            reason_source = "reason:fallback"

    rec["reason"] = reason
    rec["reason_source"] = reason_source
    rec["bullets"] = bullets


def _trim_to_top3_and_fill_message(recs: Dict[str, Any]) -> None:
    """
    recommendations を先頭3件に絞り、
    message が空なら安全な既定メッセージを補完する。

    recs を破壊的に更新する。
    """
    if not isinstance(recs, dict):
        return

    recommendations = [
        r for r in (recs.get("recommendations") or [])
        if isinstance(r, dict)
    ]
    recs["recommendations"] = recommendations[:3]

    current_message = recs.get("message")
    if isinstance(current_message, str) and current_message.strip():
        return

    top_names = [
        str(r.get("name") or "").strip()
        for r in recs.get("recommendations") or []
        if isinstance(r, dict) and str(r.get("name") or "").strip()
    ]

    if top_names:
        recs["message"] = (
            "相談内容と近さをもとに、参拝候補を3件に整理しました。"
            f" {', '.join(top_names[:3])}"
        )
    else:
        recs["message"] = (
            "条件に合いそうな神社が見つかりませんでした。条件を少しゆるめて試してください。"
        )


def _fill_location_from_existing_address(
    recs: Dict[str, Any],
) -> None:
    """
    recommendations 内の各候補について、
    既存の formatted_address / address から
    location を埋める。外部lookupはしない。
    """
    for r in recs.get("recommendations") or []:
        if not isinstance(r, dict):
            continue

        loc = r.get("location")
        if isinstance(loc, str) and loc.strip():
            continue

        addr = str(r.get("formatted_address") or r.get("address") or "").strip()
        if not addr:
            continue

        short = bf._shorten_japanese_address(addr) or addr
        r["location"] = short


def _backfill_location_from_name(
    recs: Dict[str, Any],
    *,
    bias: Optional[Dict[str, float]],
    language: str,
) -> None:
    """
    recommendations 内の各候補について、
    location も既存住所も無い場合だけ name から住所lookupして
    short location を埋める。
    """
    for r in recs.get("recommendations") or []:
        if not isinstance(r, dict):
            continue

        loc = r.get("location")
        if isinstance(loc, str) and loc.strip():
            continue

        addr = str(r.get("formatted_address") or r.get("address") or "").strip()
        if addr:
            continue

        name = str(r.get("name") or "").strip()
        if not name:
            continue

        try:
            looked_up = bf._lookup_address_by_name(name, bias=bias, lang=language)
        except Exception:
            looked_up = None

        if isinstance(looked_up, str) and looked_up.strip():
            short = bf._shorten_japanese_address(looked_up) or looked_up.strip()
            r["location"] = short
