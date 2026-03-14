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

    summary = str(rec.get("reason") or "").strip()
    reasons: List[dict] = []

    if matched:
        label = NEED_LABEL.get(matched[0], matched[0])
        reasons.append(_reason(
            "NEED_MATCH",
            "相談との一致",
            f"今の相談内容と、{label}に関わる願いごとが重なる神社です。",
            strength="high",
            evidence={"matched_need_tags": matched},
        ))

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
        "version": 1,
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

    matched = payload.get("matched_need_tags") or []
    matched = [str(x) for x in matched if str(x).strip()]

    bullets = payload.get("highlights") or []
    bullets = [str(x).strip() for x in bullets if isinstance(x, str) and str(x).strip()]

    summary = str(rec.get("reason") or "").strip()
    reasons: List[dict] = []

    if matched:
        label = NEED_LABEL.get(matched[0], matched[0])
        reasons.append(_reason(
            "NEED_MATCH",
            "相談との一致",
            f"{label}に関する相談内容との一致が見られます。",
            strength="high",
            evidence={"matched_need_tags": matched},
        ))

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
        "version": 1,
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
            log.info("[expl/chat] name=%r reasons=%r", r.get("name"), exp.get("reasons"))

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
