# backend/temples/services/concierge_chat.py
from __future__ import annotations

from typing import Any, Dict, List, Optional

import logging

from temples.llm import backfill as bf

from temples.services.concierge_candidate_normalize import normalize_candidate


log = logging.getLogger(__name__)

FLOW_DEFINITIONS = {
    "A": {
        "description": "chat balanced recommendation",
        "weights": {"element": 0.6, "need": 0.3, "popular": 0.1},
        "astro_bonus_enabled": False,
        "ui_label_ja": "バランス",
        "ui_note_ja": "条件と人気も含めて総合的におすすめしています",
    },
    "B": {
        "description": "astrology-driven exploration",
        "weights": {"element": 0.8, "need": 0.2, "popular": 0.0},
        "astro_bonus_enabled": False,
        "ui_label_ja": "占星術強め",
        "ui_note_ja": "生年月日（星座/四元素）を強く反映して並べ替えています",
    },
}

ASTRO_ELEMENT_ALIASES = {
    "fire": "fire",
    "water": "water",
    "earth": "earth",
    "air": "air",
    # JA
    "火": "fire",
    "水": "water",
    "土": "earth",
    "地": "earth",
    "風": "air",
}


def _normalize_candidates_for_chat(candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    normalized = [normalize_candidate(c) for c in (candidates or []) if isinstance(c, dict)]

    total = len(normalized)
    if total == 0:
        log.info("[svc/chat] candidates normalized: total=0")
        return normalized

    try:
        sample = normalized[0]
        log.info("[svc/chat] candidate sample keys=%s", sorted(sample.keys())[:40])
    except Exception:
        pass

    def miss(key: str) -> int:
        return sum(1 for c in normalized if not c.get(key))

    miss_name = miss("name")
    miss_lat = sum(1 for c in normalized if c.get("lat") is None or c.get("lng") is None)
    miss_addr = sum(1 for c in normalized if not (c.get("formatted_address") or c.get("address")))
    miss_place = miss("place_id")

    vals = [(c.get("place_id") or "") for c in normalized]
    nonempty = [v for v in vals if str(v).strip()]
    log.info(
        "[svc/chat] place_id stats: nonempty=%d/%d sample_nonempty=%r sample_empty=%r",
        len(nonempty),
        len(vals),
        (nonempty[0][:12] if nonempty else None),
        (vals[0] if vals else None),
    )

    def _none_if_blank(x: Any) -> Any:
        if x is None:
            return None
        if isinstance(x, str) and not x.strip():
            return None
        return x

    for c in normalized:
        if not isinstance(c, dict):
            continue
        

    log.info(
        "[svc/chat] candidates normalized: total=%d miss(name)=%d miss(latlng)=%d miss(addr)=%d miss(place_id)=%d",
        total,
        miss_name,
        miss_lat,
        miss_addr,
        miss_place,
    )
    return normalized


def _normalize_astro_elements(values: Any) -> list[str]:
    """Normalize astro element labels (JA/EN) while preserving originals for compatibility."""
    out: list[str] = []
    seen: set[str] = set()
    for v in values or []:
        s = str(v).strip()
        if not s:
            continue

        # keep original label (for compatibility)
        if s not in seen:
            out.append(s)
            seen.add(s)

        key = s.lower()
        canonical = ASTRO_ELEMENT_ALIASES.get(s, ASTRO_ELEMENT_ALIASES.get(key))
        if canonical and canonical not in seen:
            out.append(canonical)
            seen.add(canonical)
    return out


def _ensure_signals_base(
    recs: dict,
    *,
    flow: str,
    mode_weights: dict,
    astro_bonus_enabled: bool,
    flow_def: dict,
    birthdate: Optional[str],
    goriyaku_tag_ids: Optional[list[int]],
    extra_condition: Optional[str],
) -> None:
    """_signals に mode/need/astro/user_filters の骨組みを必ず入れる（contract）"""
    if not isinstance(recs.get("_signals"), dict):
        recs["_signals"] = {}

    recs["_signals"]["mode"] = {
        "flow": flow,
        "weights": dict(mode_weights),
        "astro_bonus_enabled": astro_bonus_enabled,
        "description": flow_def.get("description"),
        "ui_label_ja": flow_def.get("ui_label_ja"),
        "ui_note_ja": flow_def.get("ui_note_ja"),
    }
    recs["_signals"]["need_tags"] = (
        recs.get("_need") if isinstance(recs.get("_need"), dict) else {"tags": [], "hits": {}}
    )
    recs["_signals"]["astro"] = recs.get("_astro") if isinstance(recs.get("_astro"), dict) else None
    recs["_signals"]["user_filters"] = {
        "birthdate": birthdate,
        "goriyaku_tag_ids": goriyaku_tag_ids,
        "extra_condition": extra_condition,
    }


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


def _finalize_3(
    recs: Dict[str, Any],
    *,
    candidates: List[Dict[str, Any]],
    allow_dummy: bool = True,
) -> Dict[str, Any]:
    items = recs.get("recommendations") or []
    if not isinstance(items, list):
        items = []
    items = [r for r in items if isinstance(r, dict)]
    items = _dedupe_by_name(items)

    used = {(r.get("name") or "").strip() for r in items if (r.get("name") or "").strip()}

    for c in candidates or []:
        if len(items) >= 3:
            break
        if not isinstance(c, dict):
            continue
        nm = (c.get("name") or "").strip()
        if not nm or nm in used:
            continue
        x = dict(c)
        x.setdefault("name", nm)
        x.setdefault("reason", "")
        items.append(x)
        used.add(nm)

    while len(items) < 3:
        if not allow_dummy:
            break
        items.append({"name": "近隣の神社", "reason": ""})

    recs["recommendations"] = items[:3]
    return recs


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
        bullets.append(
            ["落ち着いて参拝しやすい", "混雑しにくい可能性", "雰囲気が希望に合う可能性"][len(bullets)]
        )
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


def _ensure_pool_size(
    recs: Dict[str, Any],
    *,
    candidates: List[Dict[str, Any]],
    size: int,
) -> Dict[str, Any]:
    items = recs.get("recommendations") or []
    if not isinstance(items, list):
        items = []
    items = [r for r in items if isinstance(r, dict)]
    items = _dedupe_by_name(items)

    used = {(r.get("name") or "").strip() for r in items if (r.get("name") or "").strip()}

    for c in candidates or []:
        if len(items) >= size:
            break
        if not isinstance(c, dict):
            continue
        nm = (c.get("name") or "").strip()
        if not nm or nm in used:
            continue

        x = dict(c)
        x.setdefault("name", nm)
        x.setdefault("reason", "")
        items.append(x)
        used.add(nm)

    recs["recommendations"] = items[:size]
    return recs


def _maybe_apply_astrology(recs: Dict[str, Any], *, birthdate: Optional[str]) -> Dict[str, Any]:
    if not birthdate:
        log.debug("[concierge][astro] birthdate is empty -> skip")
        return recs

    items = recs.get("recommendations") or []
    items_n = len(items) if isinstance(items, list) else 0
    log.info("[concierge][astro] enter birthdate=%r items=%d", birthdate, items_n)

    try:
        from temples.domain.astrology import sun_sign_and_element, element_priority, element_code
        from temples.models import Shrine
    except Exception as e:
        log.exception("[concierge][astro] import failed -> skip: %s", e)
        return recs

    prof = sun_sign_and_element(birthdate)
    if not prof:
        log.info("[concierge][astro] sun_sign_and_element returned None -> skip birthdate=%r", birthdate)
        return recs

    ELEMENT_LABEL_JA = {
        "fire": "火",
        "water": "水",
        "earth": "地",
        "air": "風",
        "火": "火",
        "水": "水",
        "土": "地",
        "風": "風",
    }

    if not isinstance(items, list) or not items:
        log.info("[concierge][astro] recommendations empty -> skip")
        return recs

    attached = 0
    for r in items:
        if not isinstance(r, dict):
            continue

        if r.get("astro_elements") is not None:
            r["astro_elements"] = _normalize_astro_elements(r.get("astro_elements"))
            continue

        name = (r.get("name") or "").strip()
        if not name:
            r["astro_elements"] = []
            continue

        try:
            s = Shrine.objects.filter(name_jp__icontains=name).only("astro_elements").first()
            r["astro_elements"] = _normalize_astro_elements(s.astro_elements) if s else []
            attached += 1
        except Exception:
            r["astro_elements"] = []

    log.info("[concierge][astro] attached astro_elements for %d items", attached)

    only_dicts = [r for r in items if isinstance(r, dict)]
    for r in only_dicts:
        pri = int(element_priority(prof.element, r.get("astro_elements")))
        r["astro_priority"] = pri
        r["astro_matched"] = (pri == 2)

    label_ja = ELEMENT_LABEL_JA.get(prof.element, str(prof.element))
    recs["_astro"] = {
        "sun_sign": prof.sign,
        "element": prof.element,
        "element_code": element_code(prof.element),
        "label_ja": label_ja,
        "matched_count": 0,
        "picked": [],
        "reason": f"{label_ja}の気質に寄せて候補を評価しました",
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
    astro_bonus_enabled: bool = False,
) -> None:
    if isinstance(rec.get("astro_elements"), list):
        rec["astro_elements"] = _normalize_astro_elements(rec.get("astro_elements"))

    pri_raw = rec.get("astro_priority")
    if isinstance(pri_raw, int):
        score_element = pri_raw
        pri = pri_raw
    else:
        score_element = 0
        pri = 0
        try:
            if birthdate:
                from temples.domain.astrology import sun_sign_and_element, element_priority

                prof = sun_sign_and_element(birthdate)
                if prof:
                    shrine_elems = rec.get("astro_elements") or []
                    pri = int(element_priority(prof.element, shrine_elems))
                    score_element = pri
        except Exception:
            pass

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

    astro_bonus = 0.0
    if astro_bonus_enabled:
        if pri == 2:
            astro_bonus = 0.6
        elif pri == 1:
            astro_bonus = 0.3

    score_total = score_element * w1 + score_need * w2 + score_popular * w3 + astro_bonus

    rec["breakdown"] = {
        "score_element": int(score_element),
        "score_need": int(score_need),
        "score_popular": float(score_popular),
        "score_total": float(score_total),
        "weights": {"element": w1, "need": w2, "popular": w3},
        "matched_need_tags": matched,
    }

    rec["score_astro"] = int(pri)
    if astro_bonus_enabled:
        rec["astro_bonus"] = float(astro_bonus)


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


def _astro_enabled(birthdate: Optional[str]) -> bool:
    if not birthdate:
        return False
    try:
        from temples.domain.astrology import sun_sign_and_element

        return bool(sun_sign_and_element(birthdate))
    except Exception:
        return False


# Contract:
# A) no candidates & no astro -> passthrough top3
# B) no candidates & astro_on -> astrology pool
# C) candidates present -> full flow
def build_chat_recommendations(
    *,
    query: str,
    language: str,
    candidates: List[Dict[str, Any]],
    bias: Optional[Dict[str, float]],
    birthdate: Optional[str],
    goriyaku_tag_ids: Optional[List[int]] = None,
    extra_condition: Optional[str] = None,
    flow: str = "A",  # "A" or "B"
) -> Dict[str, Any]:
    """
    チャット用の神社推薦を構築する。

    Flow A:
    - チャット文脈ベースの総合推薦
    - need / popular を含めたバランス型
    - astrology は補助的（説明要素）

    Flow B:
    - タグ・条件指定ベースの探索モード
    - astrology（element）を主軸に順位決定
    - popular は使わない
    - UI で「占星術を強く反映」と明示される前提
    """

    # --- DEBUG: raw candidates snapshot (before normalize) ---
    try:
        raw0 = next((c for c in (candidates or []) if isinstance(c, dict)), None)
        if raw0:
            log.info("[svc/chat] raw candidate sample keys=%s", sorted(list(raw0.keys()))[:60])
            log.info(
                "[svc/chat] raw candidate place-ish values: place_id=%r placeId=%r placeID=%r google_place_id=%r",
                raw0.get("place_id"),
                raw0.get("placeId"),
                raw0.get("placeID"),
                raw0.get("google_place_id"),
            )
    except Exception:
        pass

    # --- DEBUG: raw place-id stats (before normalize) ---
    def _nonempty(d: dict, k: str) -> bool:
        v = d.get(k)
        return isinstance(v, str) and bool(v.strip())

    try:
        raw = [c for c in (candidates or []) if isinstance(c, dict)]
        if raw:
            for k in ("place_id", "placeId", "placeID", "google_place_id"):
                n = sum(1 for c in raw if _nonempty(c, k))
                log.info("[svc/chat] raw %s nonempty=%d/%d", k, n, len(raw))
    except Exception:
        pass

    # 0. candidates 正規化（入口で一度だけ）
    candidates = _normalize_candidates_for_chat(candidates)
    valid_candidates = [c for c in candidates if (c.get("name") or "").strip()]

    log.info(
        "[svc/chat] birthdate=%r goriyaku=%r extra=%r query=%r candidates=%d",
        birthdate,
        goriyaku_tag_ids,
        extra_condition,
        (query or "")[:40],
        len(candidates or []),
    )

    # 2. LLMで初期推薦を取得
    try:
        from temples.llm.orchestrator import ConciergeOrchestrator as Orchestrator

        recs: Any = Orchestrator().suggest(query=query, candidates=valid_candidates)
    except Exception:
        recs = {"recommendations": []}

    if isinstance(recs, list):
        recs = {"recommendations": recs}
    if not isinstance(recs, dict):
        recs = {"recommendations": []}
    if "recommendations" not in recs or recs["recommendations"] is None:
        recs["recommendations"] = []

    # Orchestrator結果を正規化（dedupe）
    items0 = recs.get("recommendations") or []
    items0 = [r for r in items0 if isinstance(r, dict)]
    recs["recommendations"] = _dedupe_by_name(items0)

    # birthdate の妥当性（astro on/off）
    astro_on = _astro_enabled(birthdate)

    # flow=B なのに birthdate 無効なら A に倒す（contract簡略）
    if flow == "B" and not astro_on:
        flow = "A"

    # candidates が無い & astro も無い -> passthrough top3（テスト契約）
    if not valid_candidates and not astro_on:
        recs["recommendations"] = (recs.get("recommendations") or [])[:3]

        for r in recs["recommendations"]:
            if r.get("location") is None:
                r["location"] = ""
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

        recs["_signals"] = recs.get("_signals") if isinstance(recs.get("_signals"), dict) else {}
        recs["_signals"]["empty_reason"] = None
        return recs

    # 3. need（ご利益タグ）抽出
    _need = _extract_need(query)
    if isinstance(_need, dict):
        recs["_need"] = _need

    # 4. 候補プール（astro_onなら広めに）
    pre_limit = 12 if astro_on else 3
    recs = _ensure_pool_size(recs, candidates=valid_candidates, size=pre_limit)

    # 5. location埋め
    cand_addr: dict[str, str] = {}
    for c in valid_candidates:
        nm = (c.get("name") or "").strip()
        if not nm:
            continue
        addr = c.get("formatted_address") or c.get("address")
        if isinstance(addr, str) and addr.strip():
            cand_addr[nm] = addr.strip()

    for r in recs.get("recommendations", []):
        if not isinstance(r, dict):
            continue
        if r.get("location"):
            continue

        nm = (r.get("name") or "").strip()
        if not nm:
            continue

        if nm in cand_addr:
            addr = cand_addr[nm]
            try:
                r["location"] = bf._shorten_japanese_address(addr) or addr
            except Exception:
                r["location"] = addr
            continue

        try:
            addr = bf._lookup_address_by_name(nm, bias=bias, lang=language)
        except Exception:
            addr = None

        if isinstance(addr, str) and addr.strip():
            try:
                r["location"] = bf._shorten_japanese_address(addr) or addr
            except Exception:
                r["location"] = addr

    # 6. 候補情報の補完（lat/lng, place_id, shrine_id, address等）
    def _key(n: str) -> str:
        return _clean_display_name(n).replace(" ", "")

    cand_by_name: dict[str, dict] = {}
    for c in valid_candidates:
        nm = (c.get("name") or "").strip()
        if nm:
            cand_by_name[_key(nm)] = c

    for r in recs.get("recommendations", []) or []:
        if not isinstance(r, dict):
            continue
        nm = (r.get("name") or "").strip()
        if not nm:
            continue

        c = cand_by_name.get(_key(nm))
        if not isinstance(c, dict):
            continue

        if r.get("lat") is None and c.get("lat") is not None:
            r["lat"] = c.get("lat")
        if r.get("lng") is None and c.get("lng") is not None:
            r["lng"] = c.get("lng")
        if r.get("place_id") is None and c.get("place_id") is not None:
            r["place_id"] = c.get("place_id")
        if r.get("shrine_id") is None and c.get("shrine_id") is not None:
            r["shrine_id"] = c.get("shrine_id")

        addr2 = c.get("formatted_address") or c.get("address")
        if r.get("address") is None and isinstance(addr2, str) and addr2.strip():
            r["address"] = addr2.strip()

        if r.get("goriyaku_tag_ids") is None and c.get("goriyaku_tag_ids") is not None:
            r["goriyaku_tag_ids"] = c.get("goriyaku_tag_ids")
        if r.get("popular_score") is None and c.get("popular_score") is not None:
            r["popular_score"] = c.get("popular_score")

        if not r.get("location"):
            addr = c.get("formatted_address") or c.get("address")
            if isinstance(addr, str) and addr.strip():
                try:
                    r["location"] = bf._shorten_japanese_address(addr) or addr
                except Exception:
                    r["location"] = addr

    # --- Step6が終わった後: id を最終確定（registeredのみ） ---
    for r in recs.get("recommendations", []) or []:
        if not isinstance(r, dict):
            continue

        shrine_id = r.get("shrine_id")
        if not shrine_id:
            r.pop("id", None)
            continue

        try:
            r["id"] = int(shrine_id)
        except Exception:
            r.pop("id", None)

    # 7. ユーザーフィルタ
    try:
        recs = _apply_user_filters(recs, goriyaku_tag_ids=goriyaku_tag_ids, extra_condition=extra_condition)
    except Exception:
        pass

    try:
        recs = _ensure_pool_size(recs, candidates=valid_candidates, size=pre_limit)
    except Exception:
        log.exception("[concierge] _ensure_pool_size after filters crashed -> continue")

    # 8. 占星術（astro_onのみ）
    if pre_limit >= 12:
        try:
            recs = _maybe_apply_astrology(recs, birthdate=birthdate)
        except Exception:
            log.exception("[concierge][astro] _maybe_apply_astrology crashed -> continue")

    # 9. スコアリング
    flow_def = FLOW_DEFINITIONS.get(flow, FLOW_DEFINITIONS["A"])
    WEIGHTS = dict(flow_def["weights"])
    astro_bonus_enabled = bool(flow_def["astro_bonus_enabled"])
    mode_weights = dict(WEIGHTS)

    need_tags = list((recs.get("_need") or {}).get("tags") or [])
    need_tags = [t for t in need_tags if isinstance(t, str) and t.strip()]

    for r in recs.get("recommendations", []):
        if not isinstance(r, dict):
            continue
        _attach_breakdown(
            r,
            birthdate=birthdate,
            need_tags=need_tags,
            weights=WEIGHTS,
            astro_bonus_enabled=astro_bonus_enabled,
        )

    def _score_key(rec: Any) -> tuple[float, int]:
        if not isinstance(rec, dict):
            return (0.0, 0)
        bd = rec.get("breakdown") if isinstance(rec.get("breakdown"), dict) else {}
        try:
            score_total = float(bd.get("score_total", 0.0))
        except Exception:
            score_total = 0.0
        try:
            astro_pri = int(rec.get("astro_priority", 0))
        except Exception:
            astro_pri = 0
        return (score_total, astro_pri)

    recs["recommendations"] = sorted(recs.get("recommendations") or [], key=_score_key, reverse=True)

    # 10. lat/lng必須（ただし3件未満になるならスキップ）
    if valid_candidates:
        before_geo = list(recs.get("recommendations") or [])
        filtered = [
            r
            for r in (recs.get("recommendations") or [])
            if isinstance(r, dict) and r.get("lat") is not None and r.get("lng") is not None
        ]
        recs["recommendations"] = filtered if len(filtered) >= 3 else before_geo

    # 11. 最終3件確定
    pool_all = list(recs.get("recommendations") or [])
    recs = _finalize_3(recs, candidates=valid_candidates, allow_dummy=False)
    items = recs.get("recommendations") or []

    if not isinstance(items, list) or len(items) < 3:
        _ensure_signals_base(
            recs,
            flow=flow,
            mode_weights=mode_weights,
            astro_bonus_enabled=astro_bonus_enabled,
            flow_def=flow_def,
            birthdate=birthdate,
            goriyaku_tag_ids=goriyaku_tag_ids,
            extra_condition=extra_condition,
        )
        recs["_signals"]["empty_reason"] = "insufficient_valid_candidates"
        return recs

    # 12. 表示用整形
    for r in items:
        if not isinstance(r, dict):
            continue

        if "score_astro" not in r:
            pri_raw = r.get("astro_priority")
            r["score_astro"] = int(pri_raw) if isinstance(pri_raw, int) else 0

        if r.get("location") is None:
            r["location"] = ""

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

    # 13. astro picked
    if isinstance(recs.get("_astro"), dict):
        picked: list[str] = []
        for r in items:
            nm = r.get("display_name") or r.get("name")
            if isinstance(nm, str) and nm.strip():
                picked.append(nm.strip())
        recs["_astro"]["picked"] = picked

        recs["_astro"]["picked_matched_count"] = sum(
            1 for r in items if r.get("astro_matched") is True or r.get("astro_priority") == 2
        )

        recs["_astro"]["pool_matched_count"] = sum(
            1 for r in pool_all if isinstance(r, dict) and r.get("astro_matched") is True
        )

    # 14. signals（contract）
    _ensure_signals_base(
        recs,
        flow=flow,
        mode_weights=mode_weights,
        astro_bonus_enabled=astro_bonus_enabled,
        flow_def=flow_def,
        birthdate=birthdate,
        goriyaku_tag_ids=goriyaku_tag_ids,
        extra_condition=extra_condition,
    )

    if not isinstance(recs.get("_explain"), dict):
        recs["_explain"] = {"summary": None, "per_item": {}}

    return recs
