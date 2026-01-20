# backend/temples/services/concierge_chat.py
from __future__ import annotations

from typing import Any, Dict, List, Optional

from temples.llm import backfill as bf


def _clean_display_name(name: Any) -> str:
    """(ダミー)などの補助フラグを表示から外す"""
    if not isinstance(name, str):
        return str(name)
    n = name.replace("(ダミー)", "").replace("（ダミー）", "")
    return n.strip()


def _is_noise_reason(text: str, name: str, tags_concat: str) -> bool:
    if not text:
        return False
    low = text.strip().lower()
    if any(x in low for x in ("no ", "n/a", "tags", "deities")):
        return True
    if low in ("暫定", "placeholder") or low.startswith("暫定"):
        return True
    if text == name or (name and text.replace(" ", "") == name.replace(" ", "")):
        return True
    if len(text) <= 6 and text in tags_concat:
        return True
    if ("," in text or "、" in text) and len(text) < 20:
        return True
    return False


TAG_DEITY_HINTS: Dict[str, str] = {
    "大国主": "縁結びにご利益",
    "少彦名": "健康長寿の祈りに",
    "木花咲耶姫": "安産・子授けの祈りに",
    "応神天皇": "勝運・出世運に",
    "歓喜天": "夫婦和合・福徳に",
    "観音": "所願成就・厄除けに",
    "観音菩薩": "所願成就・厄除けに",
    "学業成就": "学業成就の祈りに",
    "金運": "金運上昇を願う参拝に",
    "商売繁盛": "商売繁盛を祈る参拝に",
}

WISH_HINTS = [
    ("縁結び", "良縁成就を願う参拝に"),
    ("恋愛", "恋愛成就の祈りに"),
    ("学業", "学業成就・合格祈願に"),
    ("金運", "金運上昇・商売繁盛を祈る参拝に"),
    ("厄除", "厄除け・心身清めの参拝に"),
    ("厄払い", "厄除け・心身清めの参拝に"),
]


def _hint_from_tags(tags: set[str]) -> str | None:
    for k, hint in TAG_DEITY_HINTS.items():
        if any(k in s for s in tags):
            return hint
    return None


def _hint_from_query(query: str) -> str | None:
    for key, hint in WISH_HINTS:
        if key in (query or ""):
            return hint
    return None


def _generic_by_popular(popular: float) -> str:
    if popular >= 7:
        return "参拝者が多く評判の社"
    if popular >= 4:
        return "地域で親しまれる社"
    return "静かに手を合わせたい社"


def normalize_reason_for_chat(rec: dict, *, query: str) -> str:
    name = (rec.get("name") or "").strip()
    raw = rec.get("reason")
    t = raw.strip() if isinstance(raw, str) else ""

    tags_list = (rec.get("tags") or []) + (rec.get("deities") or [])
    tags = set(tags_list)
    try:
        popular = float(rec.get("popular_score") or 0)
    except Exception:
        popular = 0.0

    if t and t in TAG_DEITY_HINTS:
        t = TAG_DEITY_HINTS[t]
    if _is_noise_reason(t, name, "".join([str(x) for x in tags_list])):
        t = ""

    if not t:
        t = _hint_from_tags(tags) or ""
    if not t:
        t = _hint_from_query(query) or ""
    if not t:
        t = _generic_by_popular(popular)

    t = t[:30] if len(t) > 30 else t
    return t or "静かに手を合わせたい社"


def build_bullets_for_chat(rec: dict, *, query: str) -> list[str]:
    bullets: list[str] = []

    src = rec.get("bullets") or rec.get("highlights")
    if isinstance(src, list):
        for x in src:
            if isinstance(x, str) and x.strip():
                bullets.append(x.strip())
    if bullets:
        return bullets[:3]

    tags_list = (rec.get("tags") or []) + (rec.get("deities") or [])
    tags = " ".join([t for t in tags_list if isinstance(t, str)])

    if "観音" in tags:
        bullets.append("心を整えて手を合わせたいときに向く")
    if any(k in (query or "") for k in ("厄", "厄除", "厄払い")):
        bullets.append("厄除けの参拝に合わせやすい可能性")
    if any(k in (query or "") for k in ("縁", "恋", "結")):
        bullets.append("ご縁を願う参拝に合わせやすい可能性")

    while len(bullets) < 3:
        bullets.append(["落ち着いて参拝しやすい", "混雑しにくい可能性", "雰囲気が希望に合う可能性"][len(bullets)])
    return bullets[:3]


def _dedupe_by_name(items: list[dict]) -> list[dict]:
    seen = set()
    out: list[dict] = []
    for r in items:
        name = (r.get("name") or "").strip()
        if not name or name in seen:
            continue
        seen.add(name)
        out.append(r)
    return out


def _topup_recommendations_with_candidates(
    recs: Dict[str, Any], *, candidates: List[Dict[str, Any]], limit: int = 3
) -> Dict[str, Any]:
    items = recs.get("recommendations") or []
    if not isinstance(items, list):
        items = []
    items = [x for x in items if isinstance(x, dict)]
    items = _dedupe_by_name(items)

    if len(items) >= limit:
        recs["recommendations"] = items[:limit]
        return recs

    for c in candidates or []:
        if not isinstance(c, dict):
            continue
        nm = (c.get("name") or "").strip()
        if not nm:
            continue
        if any((r.get("name") or "").strip() == nm for r in items):
            continue
        items.append({"name": nm, "reason": ""})
        if len(items) >= limit:
            break

    recs["recommendations"] = items[:limit]
    return recs


def _maybe_apply_astrology(recs: Dict[str, Any], *, birthdate: Optional[str]) -> Dict[str, Any]:
    if not birthdate:
        return recs
    try:
        from temples.domain.astrology import sun_sign_and_element, element_priority
        from temples.models import Shrine
    except Exception:
        return recs

    prof = sun_sign_and_element(birthdate)
    if not prof:
        return recs

    ELEMENT_LABEL_JA = {"fire": "火", "water": "水", "earth": "地", "air": "風"}

    items = recs.get("recommendations") or []
    if not isinstance(items, list) or not items:
        return recs

    for r in items:
        if not isinstance(r, dict):
            continue
        if r.get("astro_elements") is not None:
            continue
        name = (r.get("name") or "").strip()
        if not name:
            r["astro_elements"] = []
            continue
        try:
            s = Shrine.objects.filter(name_jp__icontains=name).only("astro_elements").first()
            r["astro_elements"] = (s.astro_elements or []) if s else []
        except Exception:
            r["astro_elements"] = []

    only_dicts = [r for r in items if isinstance(r, dict)]
    buckets: Dict[int, List[dict]] = {2: [], 1: [], 0: []}
    for r in only_dicts:
        pri = int(element_priority(prof.element, r.get("astro_elements")))
        r["astro_priority"] = pri
        r["astro_matched"] = (pri == 2)
        buckets[pri].append(r)

    # ✅ pri=2 を最優先。まずは pri=2 だけで最大3件を埋める
    picked: List[dict] = list(buckets.get(2, []))[:3]
    
    # ✅ それでも足りない時だけ pri=1 → 0 で補完
    if len(picked) < 3:
        for pri in (1, 0):
            for r in buckets.get(pri, []):
                if len(picked) >= 3:
                    break
                picked.append(r)
            if len(picked) >= 3:
                break

    recs["recommendations"] = picked

    picked_names = [x.get("name") for x in picked if isinstance(x.get("name"), str) and x.get("name").strip()]
    label_ja = ELEMENT_LABEL_JA.get(prof.element, prof.element)
    recs["_astro"] = {
        "sun_sign": prof.sign,
        "element": prof.element,
        "label_ja": label_ja,
        "matched_count": len(picked_names),
        "picked": picked_names,
        "reason": f"{label_ja}の気質に寄せて上位を選びました",
    }
    return recs


def _clamp01(x: float) -> float:
    try:
        v = float(x)
    except Exception:
        v = 0.0
    if v < 0.0:
        return 0.0
    if v > 1.0:
        return 1.0
    return v


def _extract_need(query: str) -> Dict[str, Any]:
    try:
        from temples.domain.need_tags import extract_need_tags
    except Exception:
        return {"tags": [], "hits": {}}

    try:
        ex = extract_need_tags(query, max_tags=3)
        tags = getattr(ex, "tags", []) or []
        hits = getattr(ex, "hits", {}) or {}
        if not isinstance(tags, list):
            tags = []
        tags = [t for t in tags if isinstance(t, str) and t.strip()]
        if not isinstance(hits, dict):
            hits = {}

        normalized_hits: Dict[str, List[str]] = {}
        for k, v in hits.items():
            if not isinstance(k, str) or not k.strip():
                continue
            if isinstance(v, list):
                vv = [str(x) for x in v if str(x)]
            else:
                vv = [str(v)] if v is not None else []
            normalized_hits[k] = vv

        return {"tags": tags[:3], "hits": normalized_hits}
    except Exception:
        return {"tags": [], "hits": {}}


def _attach_breakdown(
    rec: Dict[str, Any],
    *,
    birthdate: Optional[str],
    need_tags: List[str],
    weights: Dict[str, float],
) -> None:
    score_element = 0
    try:
        if birthdate:
            from temples.domain.astrology import sun_sign_and_element, element_priority
            prof = sun_sign_and_element(birthdate)
            if prof:
                shrine_elems = rec.get("astro_elements") or []
                score_element = int(element_priority(prof.element, shrine_elems))
    except Exception:
        score_element = int(rec.get("astro_priority") or 0) if isinstance(rec.get("astro_priority"), int) else 0

    shrine_tags = rec.get("astro_tags") or []
    if not isinstance(shrine_tags, list):
        shrine_tags = []
    shrine_tags = [t for t in shrine_tags if isinstance(t, str) and t.strip()]

    need_tags = [t for t in (need_tags or []) if isinstance(t, str) and t.strip()]
    matched = [t for t in need_tags if t in set(shrine_tags)]
    score_need = int(len(matched))

    try:
        popular_f = float(rec.get("popular_score") or 0.0)
    except Exception:
        popular_f = 0.0
    score_popular = _clamp01(popular_f / 10.0)

    w1 = float(weights.get("element", 0.0))
    w2 = float(weights.get("need", 0.0))
    w3 = float(weights.get("popular", 0.0))
    score_total = score_element * w1 + score_need * w2 + score_popular * w3

    rec["breakdown"] = {
        "score_element": int(score_element),
        "score_need": int(score_need),
        "score_popular": float(score_popular),
        "score_total": float(score_total),
        "weights": {"element": w1, "need": w2, "popular": w3},
        "matched_need_tags": matched,
    }


def _apply_user_filters(
    recs: Dict[str, Any],
    *,
    goriyaku_tag_ids: Optional[List[int]],
    extra_condition: Optional[str],
) -> Dict[str, Any]:
    items = recs.get("recommendations") or []
    if not isinstance(items, list) or not items:
        return recs

    gids: List[int] = []
    if isinstance(goriyaku_tag_ids, list):
        for x in goriyaku_tag_ids:
            try:
                gids.append(int(x))
            except Exception:
                pass

    extra = (extra_condition or "").strip() or None
    if not gids and not extra:
        return recs

    out: List[dict] = []
    for r in items:
        if not isinstance(r, dict):
            continue

        if gids:
            rec_tags = r.get("goriyaku_tag_ids") or []
            if not isinstance(rec_tags, list):
                rec_tags = []
            rec_tag_ints: List[int] = []
            for t in rec_tags:
                try:
                    rec_tag_ints.append(int(t))
                except Exception:
                    pass
            if not any(t in rec_tag_ints for t in gids):
                continue

        if extra:
            blob = " ".join(
                [
                    str(r.get("name") or ""),
                    str(r.get("reason") or ""),
                    " ".join([x for x in (r.get("bullets") or []) if isinstance(x, str)]),
                    " ".join([x for x in (r.get("tags") or []) if isinstance(x, str)]),
                    " ".join([x for x in (r.get("deities") or []) if isinstance(x, str)]),
                ]
            )
            if extra not in blob:
                continue

        out.append(r)

    recs["recommendations"] = out
    return recs


def build_chat_recommendations(
    *,
    query: str,
    language: str,
    candidates: List[Dict[str, Any]],
    bias: Optional[Dict[str, float]],
    birthdate: Optional[str],
    goriyaku_tag_ids: Optional[List[int]] = None,
    extra_condition: Optional[str] = None,
) -> Dict[str, Any]:
    try:
        from temples.llm.orchestrator import ConciergeOrchestrator as Orchestrator
        recs: Any = Orchestrator().suggest(query=query, candidates=candidates)
    except Exception:
        recs = {"recommendations": []}

    if isinstance(recs, list):
        recs = {"recommendations": recs}
    if not isinstance(recs, dict):
        recs = {"recommendations": []}
    if "recommendations" not in recs or recs["recommendations"] is None:
        recs["recommendations"] = []

    _need = _extract_need(query)
    if isinstance(_need, dict):
        recs["_need"] = _need

    if not recs["recommendations"]:
        if candidates and isinstance(candidates[0], dict) and candidates[0].get("name"):
            recs["recommendations"] = [{"name": candidates[0]["name"], "reason": ""}]
        else:
            recs["recommendations"] = [{"name": "近隣の神社", "reason": ""}]

    pre_limit = 12 if birthdate else 3
    recs = _topup_recommendations_with_candidates(recs, candidates=candidates, limit=pre_limit)

    # --- candidates を name で引ける辞書にする（詳細導線のため） ---
    cand_by_name: dict[str, dict] = {}
    for c in candidates or []:
        if not isinstance(c, dict):
            continue
        nm = (c.get("name") or "").strip()
        if not nm:
            continue
        cand_by_name[nm] = c

    # --- candidate fields を recommendations にマージ ---
    for r in recs.get("recommendations", []) or []:
        if not isinstance(r, dict):
            continue

        nm = (r.get("name") or "").strip()
        if not nm:
            continue

        c = cand_by_name.get(nm)
        if not isinstance(c, dict):
            continue

        if r.get("id") is None and c.get("id") is not None:
            r["id"] = c.get("id")

        if r.get("lat") is None and c.get("lat") is not None:
            r["lat"] = c.get("lat")
        if r.get("lng") is None and c.get("lng") is not None:
            r["lng"] = c.get("lng")
        if r.get("address") is None and c.get("address") is not None:
            r["address"] = c.get("address")

        if r.get("goriyaku_tag_ids") is None and c.get("goriyaku_tag_ids") is not None:
            r["goriyaku_tag_ids"] = c.get("goriyaku_tag_ids")
        if r.get("popular_score") is None and c.get("popular_score") is not None:
            r["popular_score"] = c.get("popular_score")

    # ✅ user filters → astrology → slice
    try:
        recs = _apply_user_filters(recs, goriyaku_tag_ids=goriyaku_tag_ids, extra_condition=extra_condition)
    except Exception:
        pass

    try:
        recs = _maybe_apply_astrology(recs, birthdate=birthdate)
    except Exception:
        pass

    try:
        recs["recommendations"] = (recs.get("recommendations") or [])[:3]
    except Exception:
        pass

    WEIGHTS = {"element": 0.6, "need": 0.3, "popular": 0.1}
    need_tags = list((recs.get("_need") or {}).get("tags") or [])
    if not isinstance(need_tags, list):
        need_tags = []
    need_tags = [t for t in need_tags if isinstance(t, str) and t.strip()]

    for r in recs.get("recommendations", []) or []:
        if not isinstance(r, dict):
            continue
        try:
            _attach_breakdown(r, birthdate=birthdate, need_tags=need_tags, weights=WEIGHTS)
        except Exception:
            r["breakdown"] = {
                "score_element": 0,
                "score_need": 0,
                "score_popular": 0.0,
                "score_total": 0.0,
                "weights": dict(WEIGHTS),
                "matched_need_tags": [],
            }
    # ✅ 最終順位：score_total でソート（A案）
    try:
        recs["recommendations"] = sorted(
            recs.get("recommendations") or [],
            key=lambda r: (
                r.get("breakdown", {}).get("score_total", 0.0)
                if isinstance(r, dict)
                else 0.0
            ),
            reverse=True,
        )
    except Exception:
        pass

    for r in recs.get("recommendations", []) or []:
        if not isinstance(r, dict):
            continue

        if r.get("name"):
            cleaned = _clean_display_name(r["name"])
            r["display_name"] = cleaned
            r["name"] = cleaned

        try:
            r["reason"] = normalize_reason_for_chat(r, query=query)
        except Exception:
            r["reason"] = "静かに手を合わせたい社"

        try:
            r["bullets"] = build_bullets_for_chat(r, query=query)
        except Exception:
            r["bullets"] = ["落ち着いて参拝しやすい", "混雑しにくい可能性", "雰囲気が希望に合う可能性"]

    # ✅ デバッグは関数内だけ
    if __debug__:
        try:
            import logging
            log = logging.getLogger(__name__)
            keys = [sorted(list(rr.keys())) for rr in (recs.get("recommendations") or []) if isinstance(rr, dict)]
            log.debug("CHAT rec keys: %s", keys)
        except Exception:
            pass

    return recs
