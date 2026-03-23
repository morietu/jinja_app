from __future__ import annotations

from typing import Any, Dict, List


NEED_LABELS_JA: Dict[str, str] = {
    "study": "学業・合格",
    "career": "転機・仕事",
    "mental": "不安・心",
    "love": "恋愛",
    "money": "金運",
    "rest": "休息",
    "courage": "前進・後押し",
    "element": "生年月日との相性",
    "fallback": "近い候補",
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


def _normalize_reason_facts(value: Any, *, limit: int | None = None) -> List[Dict[str, Any]]:
    if not isinstance(value, list):
        return []

    out: List[Dict[str, Any]] = []
    for item in value:
        if not isinstance(item, dict):
            continue

        type_ = str(item.get("type") or "").strip()
        label = str(item.get("label") or "").strip()
        label_ja = str(item.get("label_ja") or "").strip() or NEED_LABELS_JA.get(label, label or None)
        evidence = _safe_str_list(item.get("evidence"), limit=5)
        score = float(item.get("score") or 0.0)
        is_primary = bool(item.get("is_primary"))

        if not type_:
            continue

        out.append(
            {
                "type": type_,
                "label": label,
                "label_ja": label_ja,
                "evidence": evidence,
                "score": score,
                "is_primary": is_primary,
            }
        )

    if limit is not None:
        return out[:limit]
    return out


def build_explanation_payload(rec: Dict[str, Any]) -> Dict[str, Any]:
    """
    explanation 用の正規化 payload を作る。

    用語定義:
    - primary_need_tag:
      相談全体の中心テーマ。ユーザー意図の主語。
      detail で「相談の中心」を説明するために使う。
    - primary_reason:
      この神社が上位に入った直接理由。順位根拠の主語。
      card や explanation で「なぜこの候補か」を説明するために使う。

    この payload 自体は自然文を生成せず、
    explanation 表示用の構造化データだけを持つ。
    """

    breakdown = rec.get("breakdown") if isinstance(rec.get("breakdown"), dict) else {}
    breakdown_detail = (
        rec.get("breakdown_detail")
        if isinstance(rec.get("breakdown_detail"), dict)
        else {}
    )

    # 相談文脈
    matched_need_tags = _safe_str_list(
        breakdown.get("matched_need_tags"),
        limit=3,
    )
    primary_need_tag = matched_need_tags[0] if matched_need_tags else None
    primary_need_label_ja = NEED_LABELS_JA.get(primary_need_tag or "", None)

    # 表示補助
    highlights = _safe_str_list(rec.get("highlights"), limit=3)
    # reason_source は表示文の生成経路を表す。primary_reason そのものではない。
    reason_source = str(rec.get("reason_source") or "").strip() or None
    original_reason = str(rec.get("reason") or "").strip() or None

    # スコア
    score_element = int(breakdown.get("score_element") or 0)
    score_need = int(breakdown.get("score_need") or 0)
    score_total = float(breakdown.get("score_total") or 0.0)

    score_total_ranked = 0.0
    if isinstance(breakdown_detail.get("features"), dict):
        score_total_ranked = float(
            (breakdown_detail["features"].get("score_total_ranked") or 0.0)
        )

    # 候補採用理由
    reason_facts = _normalize_reason_facts(
        rec.get("_reason_facts"),
        limit=5,
    )

    primary_reason = next(
        (x for x in reason_facts if x.get("is_primary")),
        None,
    )

    if primary_reason is None:
        source = str(rec.get("_primary_reason_source") or "").strip()
        label = str(rec.get("_primary_reason_label") or "").strip()
        if source:
            primary_reason = {
                "type": source,
                "label": label,
                "label_ja": NEED_LABELS_JA.get(label, label or NEED_LABELS_JA.get(source, source)),
                "evidence": [],
                "score": 0.0,
                "is_primary": True,
            }

    secondary_reasons = [x for x in reason_facts if not x.get("is_primary")]

    return {
        "version": 2,
        "matched_need_tags": matched_need_tags,
        "primary_need_tag": primary_need_tag,
        "primary_need_label_ja": primary_need_label_ja,
        "primary_reason": primary_reason,
        "secondary_reasons": secondary_reasons[:3],
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
