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
}

SOFT_SIGNAL_HIGHLIGHTS: Dict[str, str] = {
    "calm": "落ち着いて気持ちを整えやすい雰囲気",
}


def _apply_location_backfill(
    recs: Dict[str, Any],
    *,
    bias: Optional[Dict[str, float]],
    language: str,
) -> None:
    """
    recommendations 内の各候補に location が無い場合、
    名前から住所を補完して短い location を埋める。

    注意:
    - recs を破壊的に更新する
    - 失敗時は何もしない
    """
    for r in recs.get("recommendations") or []:
        if not isinstance(r, dict):
            continue

        loc = r.get("location")
        if isinstance(loc, str) and loc.strip():
            continue

        name = str(r.get("name") or "").strip()
        if not name:
            continue

        try:
            addr = bf._lookup_address_by_name(name, bias=bias, lang=language)
        except Exception:
            addr = None

        if isinstance(addr, str) and addr.strip():
            short = bf._shorten_japanese_address(addr) or addr.strip()
            r["location"] = short


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

    highlights = rec.get("highlights") or []
    if not isinstance(highlights, list):
        highlights = []

    bullets = [
        str(x).strip()
        for x in highlights
        if isinstance(x, str) and str(x).strip()
    ][:2]

    if matched:
        first = str(matched[0]).strip()
        reason = NEED_REASON_LABELS.get(first, "相談内容に合うご利益・特徴があります。")
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
