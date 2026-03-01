# temples/services/concierge_explanation.py
from __future__ import annotations
from typing import Any, Dict, List, Optional

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
        "START_POINT": 5,
        "DISTANCE": 6,
        "POPULARITY": 7,
    }
    ys = [x for x in xs if isinstance(x, dict)]
    ys.sort(key=lambda x: (
        strength_pri.get(x.get("strength"), 9),
        code_pri.get(x.get("code"), 99),
    ))
    return ys[:3]

def _reason(code: str, label: str, text: str, *, evidence: Optional[dict] = None, strength: str = "mid") -> dict:
    return {
        "code": code,
        "label": label,
        "text": text,
        "strength": strength,
        "evidence": evidence or {},
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
    reasons: List[dict] = []

    # 1) AREA_MATCH
    if isinstance(area, str) and area.strip():
        reasons.append(_reason(
            "AREA_MATCH", "エリア一致",
            f"{area.strip()}周辺で組み立てています。",
            strength="high", evidence={"area": area.strip()},
        ))

    # 1.5) START_POINT
    if bias and bias.get("lat") is not None and bias.get("lng") is not None:
        reasons.append(_reason(
            "START_POINT", "起点座標",
            "指定された起点付近を優先しています。",
            strength="mid", evidence={"lat": bias.get("lat"), "lng": bias.get("lng")},
        ))

    # 2) BREAKDOWN（chatで効く本体）
    bd = rec.get("breakdown") if isinstance(rec.get("breakdown"), dict) else {}

    se = bd.get("score_element")
    if isinstance(se, int) and se >= 2:
        reasons.append(_reason(
            "ELEMENT_MATCH", "気質との相性",
            "あなたの気質との相性が強めです。",
            strength="high", evidence={"score_element": se},
        ))
    elif isinstance(se, int) and se == 1:
        reasons.append(_reason(
            "ELEMENT_MATCH", "気質との相性",
            "あなたの気質とほどよく相性が合います。",
            strength="mid", evidence={"score_element": se},
        ))

    mnt = bd.get("matched_need_tags") or []
    if isinstance(mnt, list):
        mnt = [str(x) for x in mnt if str(x).strip()][:2]
    if mnt:
        reasons.append(_reason(
            "NEED_MATCH", "願いとの一致",
            f"希望（{', '.join(mnt)}）に関連する傾向があります。",
            strength="mid", evidence={"matched_need_tags": mnt},
        ))

    # 3) WISH_MATCH（既存 reason を使う。ここで発明しない）
    base_reason = rec.get("reason")
    if isinstance(base_reason, str) and base_reason.strip():
        reasons.append(_reason(
            "WISH_MATCH", "願いとの相性",
            base_reason.strip(), strength="mid",
        ))

    # 4) DISTANCE
    dk = _fmt_km(rec.get("distance_m"))
    if dk:
        reasons.append(_reason(
            "DISTANCE", "行きやすさ",
            f"起点から約{dk}です。",
            strength="low", evidence={"distance_m": rec.get("distance_m")},
        ))

    # 5) POPULARITY
    try:
        pop = float(rec.get("popular_score") or 0.0)
    except Exception:
        pop = 0.0
    if pop >= 4:
        reasons.append(_reason(
            "POPULARITY", "人気",
            "参拝者が多く評判の傾向があります。",
            strength="low", evidence={"popular_score": pop},
        ))

    # 最後に上位3つ
    reasons = _take3(reasons)

    name = (rec.get("display_name") or rec.get("name") or "").strip() or "この候補"
    summary = f"{name}は、条件に沿って組み込まれた候補です。" if reasons else f"{name}を候補に入れています。"

    return {
        "version": 1,
        "summary": summary,
        "reasons": reasons,
        "disclaimer": "提案は参考情報です。安全と現地状況を優先してください。",
    }

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
                area=area,          # ✅ planはareaを渡す
                bias=bias,
                birthdate=birthdate,
                wish=wish,          # ✅ planのwish
            )
    return filled

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

    # chatはarea無し前提
    area = None

    for r in items:
        if isinstance(r, dict):
            exp = build_explanation_for_plan_rec(
                r,
                query=query,
                area=area,
                bias=bias,
                birthdate=birthdate,
                wish=None,  # ← chatのextra_conditionをwish扱いしないならNone
            )

            # extra_condition を出したいなら explanation 側に「根拠」として差し込む
            extra = (extra_condition or "").strip()
            if extra and isinstance(exp.get("reasons"), list):
                uc = _reason(
                    "USER_CONDITION", "追加条件",
                    f"追加条件「{extra}」も考慮しています。",
                    strength="mid",
                    evidence={"extra_condition": extra},
                )
                exp["reasons"].append(uc)
                exp["reasons"] = _take3(exp["reasons"])

            r["explanation"] = exp

    return recs
