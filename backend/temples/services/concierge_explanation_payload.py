from __future__ import annotations

from typing import Any, Dict, List


NEED_LABELS_JA: Dict[str, str] = {
    "study": "学業・合格",
    "career": "転機・仕事",
    "mental": "不安・心",
    "love": "恋愛",
    "money": "金運",
    "rest": "休息",
}


def _safe_str_list(value: Any, *, limit: int | None = None) -> List[str]:
    if not isinstance(value, list):
        return []

    out: List[str] = []
    for x in value:
        if not isinstance(x, str):
            continue
        s = x.strip()
        if not s:
            continue
        if s not in out:
            out.append(s)

    if limit is not None:
        return out[:limit]
    return out


def build_explanation_payload(rec: Dict[str, Any]) -> Dict[str, Any]:
    """
    ranking / presentation / explanations 間で共有する
    explanation 用の正規化 payload を作る。

    この payload は自然文を持たず、
    あくまで説明材料だけをまとめる。
    """
    breakdown = rec.get("breakdown") if isinstance(rec.get("breakdown"), dict) else {}
    breakdown_detail = (
        rec.get("breakdown_detail")
        if isinstance(rec.get("breakdown_detail"), dict)
        else {}
    )

    matched_need_tags = _safe_str_list(
        breakdown.get("matched_need_tags"),
        limit=3,
    )
    highlights = _safe_str_list(rec.get("highlights"), limit=3)

    primary_need_tag = matched_need_tags[0] if matched_need_tags else None
    primary_need_label_ja = NEED_LABELS_JA.get(primary_need_tag or "", None)

    reason_source = str(rec.get("reason_source") or "").strip() or None
    original_reason = str(rec.get("reason") or "").strip() or None

    score_element = int(breakdown.get("score_element") or 0)
    score_need = int(breakdown.get("score_need") or 0)

    score_total = float(breakdown.get("score_total") or 0.0)

    score_total_ranked = 0.0
    if isinstance(breakdown_detail.get("features"), dict):
        score_total_ranked = float(
            (breakdown_detail["features"].get("score_total_ranked") or 0.0)
        )

    return {
        "version": 1,
        "matched_need_tags": matched_need_tags,
        "primary_need_tag": primary_need_tag,
        "primary_need_label_ja": primary_need_label_ja,
        "highlights": highlights,
        "reason_source": reason_source,
        "original_reason": original_reason,
        "score": {
            "element": score_element,
            "need": score_need,
            "total": score_total,
            "total_ranked": score_total_ranked,
        },
    }


def attach_explanation_payload(recs: Dict[str, Any]) -> Dict[str, Any]:
    items = recs.get("recommendations") or []
    if not isinstance(items, list):
        return recs

    for rec in items:
        if not isinstance(rec, dict):
            continue
        rec["_explanation_payload"] = build_explanation_payload(rec)

    return recs


__all__ = [
    "NEED_LABELS_JA",
    "build_explanation_payload",
    "attach_explanation_payload",
]
