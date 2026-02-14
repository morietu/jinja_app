# backend/temples/services/places_rank.py

import re
from typing import Any, Dict, List, Tuple



PARENT_HINTS = ["神社","寺","寺院","大社","宮","天満宮","稲荷","八幡","観音","大寺"]
SUB_HINTS = ["神楽殿","社務所","授与所","宝物殿","参集殿","祈祷殿","客殿","本殿","拝殿","手水舎","鳥居","楼門","社殿","舞殿"]
STOP = {"", "　", " ", "\t", "\n"}
PLACE_SUFFIXES = ("区","市","町","村","郡","県","都","府","駅","丁目","番","号")

def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip()).lower()

def tokenize(q: str) -> List[str]:
    qn = _norm(q).replace("　", " ")
    toks = [t for t in qn.split(" ") if t and t not in STOP]
    return toks[:8]

def is_parentish_token(t: str) -> bool:
    return any(h in t for h in PARENT_HINTS) or ("神社" in t) or ("寺" in t)

def is_subish_token(t: str) -> bool:
    return any(h in t for h in SUB_HINTS)

def is_subfacility_result_name(name_norm: str) -> bool:
    # name_norm は _norm 済み前提
    return any(h in name_norm for h in SUB_HINTS) or name_norm in {"神楽殿", "社務所", "授与所", "宝物殿", "参集殿"}

def count_contains(hay: str, needle: str) -> int:
    if not hay or not needle:
        return 0
    return 1 if needle in hay else 0

def place_text(r: Dict[str, Any]) -> Tuple[str, str]:
    name = _norm(str(r.get("name") or ""))
    addr = _norm(str(r.get("address") or r.get("formatted_address") or ""))
    return name, addr

def _is_placeish_token(t: str) -> bool:
    if len(t) < 2:
        return False
    if is_parentish_token(t) or is_subish_token(t):
        return False
    return t.endswith(PLACE_SUFFIXES)

def _is_short_placeish_fallback(t: str) -> bool:
    if not (2 <= len(t) <= 6):
        return False
    if is_parentish_token(t) or is_subish_token(t):
        return False
    if re.search(r"[a-z0-9]", t) or re.search(r"[-_/]", t):
        return False
    if re.fullmatch(r"[ぁ-ん]+", t):
        return False
    return True

def score_place(q: str, r: Dict[str, Any], base_rank: int) -> int:
    toks = tokenize(q)
    if not toks:
        return 10_000 - base_rank

    name, addr = place_text(r)
    score = 10_000 - base_rank

    for t in toks:
        score += 200 * count_contains(name, t)
        score += 40 * count_contains(addr, t)
        if _is_placeish_token(t) or _is_short_placeish_fallback(t):
            score += 30 * count_contains(addr, t)

    parent_toks = [t for t in toks if is_parentish_token(t)]
    for t in parent_toks:
        score += 1200 * count_contains(name, t)
        score += 80 * count_contains(addr, t)

    sub_toks = [t for t in toks if is_subish_token(t)]
    parent_hit = any(count_contains(name, pt) for pt in parent_toks) if parent_toks else False

    for t in sub_toks:
        sub_hit_name = count_contains(name, t)
        sub_hit_addr = count_contains(addr, t)
        if parent_hit:
            score += 500 * sub_hit_name
            score += 120 * sub_hit_addr
        else:
            score += 120 * sub_hit_name
            score += 30 * sub_hit_addr
        if parent_toks and (sub_hit_name or sub_hit_addr) and not parent_hit:
            score -= 300

    if name in {"神楽殿","社務所","授与所","宝物殿","参集殿"}:
        score -= 400

    # 親語がクエリに無いのに、結果がサブ施設っぽいのは沈める
    if not parent_toks:
        is_sub = is_subfacility_result_name(name)
        if is_sub:
            score -= 600

        # 「神社/寺/宮」救済は、サブ施設っぽくない時だけ
        if (not is_sub) and any(k in name for k in ["神社", "寺", "寺院", "大社", "宮"]):
            score += 120

    return score
