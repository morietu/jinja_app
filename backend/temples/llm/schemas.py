from typing import Any, Dict, List, Optional
import re

# ---------- 基本の正規化 ----------
def _first_list_in_dict(d: Dict[str, Any]) -> List[Dict[str, Any]]:
    for v in d.values():
        if isinstance(v, list):
            return v
    return []

def normalize_recs(js: Dict[str, Any], query: str = '') -> Dict[str, Any]:
    """
    自由形式のLLM JSONを { recommendations: [{name, location, reason}] } に正規化。
    日本語キー（名称/住所/特徴/説明）も吸収する。
    """
    items = _first_list_in_dict(js) if isinstance(js, dict) else []
    out: List[Dict[str, str]] = []
    for it in items:
        if not isinstance(it, dict):
            continue
        name = it.get("name") or it.get("名称") or it.get("神社名") or ""
        loc  = it.get("location") or it.get("住所") or it.get("場所") or ""
        reason = (it.get("reason") or it.get("特徴") or it.get("説明") or it.get("description") or "").strip()
        if name:
            out.append({"name": name, "location": loc, "reason": reason})
    return {"recommendations": out}

# ---------- 補完ユーティリティ ----------
def _intent_reason(query: str) -> str:
    q = (query or "").lower()
    def has(*ws): return any(w in q for w in ws)
    if has("恋愛","縁結び","えんむすび"): return "縁結び・恋愛成就で知られる神社です。"
    if has("学業","合格","勉学","受験"): return "学業成就・合格祈願で参拝者が多い神社です。"
    if has("仕事","商売","出世","昇進"): return "仕事運・商売繁盛のご利益で知られています。"
    if has("金運","財運","開運"):       return "金運・開運のご利益で有名です。"
    if has("健康","病気平癒","安産"):   return "健康祈願・安産祈願で信仰を集めています。"
    if has("厄除","厄払い","方位","方角"): return "厄除け・方位除けの参拝に適しています。"
    return "ご利益で知られる神社です。"

def _pick_location(src: Dict[str, Any]) -> str:
    for k in ("location","住所","formatted_address","vicinity","city","ward","area"):
        v = src.get(k)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return ""

# ---------- 最終補完 ----------
def complete_recommendations(data: Dict[str, Any], query: str = "", candidates: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    """
    {recommendations:[{name,location,reason}]} を安全に補完する。
    - reason が空なら query の意図から定型を埋める
    - location が空なら candidates から同名の住所等を拝借
    """
    if not isinstance(data, dict):
        return data
    recs = data.get("recommendations") or []
    if not isinstance(recs, list):
        return data

    intent = _intent_reason(query)
    candidates = candidates or []

    for r in recs:
        if not isinstance(r, dict):
            continue
        # reason 補完
        reason = (r.get("reason") or "").strip()
        if not reason:
            r["reason"] = intent
        # location 補完
        loc = (r.get("location") or "").strip()
        if not loc and candidates:
            rname = (r.get("name") or "").strip()
            for c in candidates:
                cname = (str(c.get("name") or c.get("名称") or "")).strip()
                if cname and rname and cname == rname:
                    loc2 = _pick_location(c)
                    if loc2:
                        r["location"] = loc2
                        break
    return {"recommendations": recs}


def _pick_location_from_candidate(c: Dict[str, Any]) -> str:
    for key in ("formatted_address","vicinity","address","location","addr","address1"):
        v = c.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip()
    parts = [c.get(k,"") for k in ("prefecture","city","ward","town","chome","block","building")]
    parts = [p for p in parts if isinstance(p,str) and p.strip()]
    return " ".join(parts)

def _norm_name(x: str) -> str:
    return re.sub(r"\s+", "", (x or "")).lower()
