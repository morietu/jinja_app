from __future__ import annotations

from typing import Any, Dict, List, Optional
import logging

log = logging.getLogger(__name__)

NEED_LABEL = {
    "career": "転機・仕事",
    "study": "学業・合格",
    "mental": "不安・心",
    "love": "恋愛",
    "money": "金運",
    "rest": "休息",
    "courage": "前進・後押し",
    "protection": "厄除け・守護",
    "focus": "集中・継続",
}


def _fmt_km(distance_m: Any) -> Optional[str]:
    try:
        d = float(distance_m)
    except Exception:
        return None
    if d <= 0:
        return None
    km = d / 1000.0
    if km < 1:
        return f"{int(round(d))}m"
    return f"{km:.1f}km"


def _take3(xs: List[dict]) -> List[dict]:
    strength_pri = {"high": 0, "mid": 1, "low": 2}
    code_pri = {
        "USER_CONDITION": 0,
        "AREA_MATCH": 1,
        "ELEMENT_MATCH": 2,
        "NEED_MATCH": 3,
        "WISH_MATCH": 4,
        "REASON_SOURCE": 5,
        "SHRINE_FEATURE": 6,
        "START_POINT": 7,
        "DISTANCE": 8,
        "POPULARITY": 9,
        "SCORE": 10,
    }
    ys = [x for x in xs if isinstance(x, dict)]
    ys.sort(
        key=lambda x: (
            strength_pri.get(x.get("strength"), 9),
            code_pri.get(x.get("code"), 99),
        )
    )
    return ys[:3]


def _reason(
    code: str,
    label: str,
    text: str,
    *,
    evidence: Optional[dict] = None,
    strength: str = "mid",
) -> dict:
    return {
        "code": code,
        "label": label,
        "text": text,
        "strength": strength,
        "evidence": evidence or {},
    }


def _get_explanation_payload(rec: Dict[str, Any]) -> Dict[str, Any]:
    payload = rec.get("_explanation_payload")
    if isinstance(payload, dict):
        return payload
    return {}

def _get_primary_reason(payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    primary = payload.get("primary_reason")
    if isinstance(primary, dict):
        return primary
    return None


def _get_secondary_reasons(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    value = payload.get("secondary_reasons")
    if not isinstance(value, list):
        return []
    return [x for x in value if isinstance(x, dict)]

def _build_summary_from_primary_reason(
    *,
    primary_reason: Optional[Dict[str, Any]],
    original_reason: Optional[str],
    highlights: List[str],
) -> str:
    if isinstance(primary_reason, dict):
        reason_type = str(primary_reason.get("type") or "").strip()
        label_ja = str(primary_reason.get("label_ja") or "").strip()

        if reason_type == "need_tag" and label_ja:
            return f"{label_ja}に関わる願いごとと重なる神社です。"

        if reason_type == "goriyaku_tag" and label_ja:
            return f"{label_ja}のご利益と重なる候補としておすすめしています。"

        if reason_type == "text_hint" and label_ja:
            return f"{label_ja}に関わる相談内容との重なりが見られます。"

        if reason_type == "element":
            return "生年月日から見た相性を中心におすすめしています。"

        if reason_type == "fallback":
            return "今の条件に近い候補としておすすめしています。"

    if original_reason:
        return original_reason

    if highlights:
        return highlights[0]

    return "条件に合わせて候補を整理しました。"



def _build_reason_entry_from_primary_reason(
    *,
    primary_reason: Optional[Dict[str, Any]],
    birthdate: Optional[str],
) -> Optional[dict]:
    if not isinstance(primary_reason, dict):
        return None

    reason_type = str(primary_reason.get("type") or "").strip()
    label_ja = str(primary_reason.get("label_ja") or "").strip()
    evidence = primary_reason.get("evidence") if isinstance(primary_reason.get("evidence"), list) else []

    if reason_type == "need_tag":
        return _reason(
            "NEED_MATCH",
            "相談との一致",
            f"{label_ja}に関する願いごととの一致が見られます。",
            strength="high",
            evidence={"primary_reason": primary_reason, "evidence": evidence},
        )

    if reason_type == "goriyaku_tag":
        return _reason(
            "WISH_MATCH",
            "ご利益との一致",
            f"{label_ja}に関わるご利益との重なりが見られます。",
            strength="high",
            evidence={"primary_reason": primary_reason, "evidence": evidence},
        )

    if reason_type == "text_hint":
        return _reason(
            "NEED_MATCH",
            "相談文との一致",
            f"{label_ja}に関わる相談内容との重なりが見られます。",
            strength="high",
            evidence={"primary_reason": primary_reason, "evidence": evidence},
        )

    if reason_type == "element":
        return _reason(
            "ELEMENT_MATCH",
            "生年月日との相性",
            "生年月日から見た傾向との相性を考慮しています。",
            strength="high",
            evidence={"primary_reason": primary_reason, "birthdate": bool(birthdate)},
        )

    if reason_type == "fallback":
        return _reason(
            "REASON_SOURCE",
            "候補の整理",
            "明確な一致が弱いため、今の条件に近い候補として整理しています。",
            strength="mid",
            evidence={"primary_reason": primary_reason},
        )

    return None

def build_explanation_for_chat_rec(
    rec: Dict[str, Any],
    *,
    query: str,
    bias: Optional[Dict[str, float]],
    birthdate: Optional[str] = None,
    extra_condition: Optional[str] = None,
) -> Dict[str, Any]:
    payload = _get_explanation_payload(rec)

    matched = payload.get("matched_need_tags") or []
    matched = [str(x) for x in matched if str(x).strip()]

    bullets = payload.get("highlights") or []
    bullets = [str(x).strip() for x in bullets if isinstance(x, str) and str(x).strip()]

    original_reason = _first_non_empty(
        payload.get("original_reason"),
        rec.get("reason"),
    )

    primary_reason = _get_primary_reason(payload)

    summary = _build_summary_from_primary_reason(
        primary_reason=primary_reason,
        original_reason=original_reason,
        highlights=bullets,
    )

    reason_source = str(payload.get("reason_source") or "").strip()
    if reason_source == "reason:matched_need_tags":
        summary = _first_non_empty(rec.get("reason"), original_reason, summary) or summary

    reasons: List[dict] = []

    primary_entry = _build_reason_entry_from_primary_reason(
        primary_reason=primary_reason,
        birthdate=birthdate,
    )
    if primary_entry:
        reasons.append(primary_entry)

    if bullets:
        reasons.append(_reason(
            "SHRINE_FEATURE",
            "神社の特徴",
            bullets[0],
            strength="mid",
            evidence={"bullet": bullets[0]},
        ))

    extra = (extra_condition or "").strip()
    if extra:
        reasons.append(_reason(
            "USER_CONDITION",
            "追加条件",
            f"追加条件「{extra}」も考慮しています。",
            strength="mid",
            evidence={"extra_condition": extra},
        ))

    reasons = _take3(reasons)

    return {
        "version": 2,
        "summary": summary or "条件に合わせて候補を整理しました。",
        "reasons": reasons,
        "disclaimer": "提案は参考情報です。安全と現地状況を優先してください。",
    }

def build_explanation_for_plan_rec(
    rec: Dict[str, Any],
    *,
    query: str,
    area: Optional[str],
    bias: Optional[Dict[str, float]],
    birthdate: Optional[str] = None,
    wish: Optional[str] = None,
) -> Dict[str, Any]:
    payload = _get_explanation_payload(rec)

    bullets = payload.get("highlights") or []
    bullets = [str(x).strip() for x in bullets if isinstance(x, str) and str(x).strip()]

    original_reason = _first_non_empty(
        payload.get("original_reason"),
        rec.get("reason"),
    )

    primary_reason = _get_primary_reason(payload)

    summary = _build_summary_from_primary_reason(
        primary_reason=primary_reason,
        original_reason=original_reason,
        highlights=bullets,
    )

    reasons: List[dict] = []

    primary_entry = _build_reason_entry_from_primary_reason(
        primary_reason=primary_reason,
        birthdate=birthdate,
    )
    if primary_entry:
        reasons.append(primary_entry)

    if bullets:
        reasons.append(_reason(
            "SHRINE_FEATURE",
            "神社の特徴",
            bullets[0],
            strength="mid",
            evidence={"bullet": bullets[0]},
        ))

    if area:
        reasons.append(_reason(
            "AREA_MATCH",
            "エリアとの一致",
            f"{area}エリアで参拝先を整理しています。",
            strength="mid",
            evidence={"area": area},
        ))

    if wish:
        reasons.append(_reason(
            "WISH_MATCH",
            "願いごととの一致",
            f"願いごと「{wish}」も踏まえて候補を整理しています。",
            strength="mid",
            evidence={"wish": wish},
        ))

    reasons = _take3(reasons)

    return {
        "version": 2,
        "summary": summary or "条件に合わせて候補を整理しました。",
        "reasons": reasons,
        "disclaimer": "提案は参考情報です。安全と現地状況を優先してください。",
    }


def attach_explanations_for_chat(
    recs: Dict[str, Any],
    *,
    query: str,
    bias: Optional[Dict[str, float]],
    birthdate: Optional[str] = None,
    extra_condition: Optional[str] = None,
) -> Dict[str, Any]:
    items = recs.get("recommendations") or []
    if not isinstance(items, list):
        return recs

    for r in items:
        if isinstance(r, dict):
            exp = build_explanation_for_chat_rec(
                r,
                query=query,
                bias=bias,
                birthdate=birthdate,
                extra_condition=extra_condition,
            )
            r["explanation"] = exp
            log.info(
                "[expl/chat] name=%r summary=%r reasons=%r",
                r.get("name"),
                exp.get("summary"),
                exp.get("reasons"),
            )

    return recs


def attach_explanations_for_plan(
    filled: Dict[str, Any],
    *,
    query: str,
    area: Optional[str],
    bias: Optional[Dict[str, float]],
    birthdate: Optional[str] = None,
    wish: Optional[str] = None,
) -> Dict[str, Any]:
    items = filled.get("recommendations") or []
    if not isinstance(items, list):
        return filled

    for r in items:
        if isinstance(r, dict):
            r["explanation"] = build_explanation_for_plan_rec(
                r,
                query=query,
                area=area,
                bias=bias,
                birthdate=birthdate,
                wish=wish,
            )
    return filled

def _build_need_match_text(matched: List[str]) -> str:
    tags = [str(x).strip() for x in matched if str(x).strip()]

    if not tags:
        return "今の相談内容に関わる願いごとと重なる神社です。"

    tag_set = set(tags)

    if "mental" in tag_set and "rest" in tag_set:
        return "疲れをゆるめ、心を整えながら落ち着いて休息したい気持ちに重なる神社です。"

    if "career" in tag_set and "mental" in tag_set and "courage" in tag_set:
        return "転職や仕事の不安に向き合いながら、背中を押されるように前へ進みたい気持ちに重なる神社です。"

    if "money" in tag_set and "courage" in tag_set:
        return "金運を整えつつ、行動のきっかけや前向きな流れを得たい気持ちに重なる神社です。"

    if "career" in tag_set and "courage" in tag_set:
        return "仕事や転機に向き合いながら、前進や後押しを求める気持ちに重なる神社です。"

    if "mental" in tag_set and "courage" in tag_set:
        return "不安を整えながら、前向きに一歩踏み出したい気持ちに重なる神社です。"

    if "love" in tag_set:
        return "良縁や恋愛を前向きに進めたい気持ちに重なる神社です。"

    if "study" in tag_set:
        return "学業・合格に向けて、資格や試験へ集中して努力を積み上げたい気持ちに重なる神社です。"

    label = NEED_LABEL.get(tags[0], tags[0])
    return f"今の相談内容と、{label}に関わる願いごとが重なる神社です。"


def _first_non_empty(*values: Any) -> Optional[str]:
    for v in values:
        s = str(v or "").strip()
        if s:
            return s
    return None


def _build_chat_summary(
    matched: List[str],
    *,
    original_reason: Optional[str],
    highlights: List[str],
) -> str:
    tags = [str(x).strip() for x in matched if str(x).strip()]
    tag_set = set(tags)

    if "career" in tag_set and "mental" in tag_set and "courage" in tag_set:
        return "転機への不安を整えながら、一歩踏み出したい時の参拝に"

    if "money" in tag_set and "courage" in tag_set:
        return "金運を整えつつ、前向きに動き出すきっかけを得たい時の参拝に"

    if "mental" in tag_set and "rest" in tag_set:
        return "疲れた気持ちを整え、落ち着いて休息したい時の参拝に"

    if "career" in tag_set and "courage" in tag_set:
        return "仕事や転機に向き合いながら、前へ進みたい時の参拝に"

    if "mental" in tag_set and "courage" in tag_set:
        return "不安を整えながら、前向きに進みたい時の参拝に"

    if original_reason:
        return original_reason

    if highlights:
        return highlights[0]

    return "条件に合わせて候補を整理しました。"
