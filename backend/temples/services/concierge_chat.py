from __future__ import annotations
import os
import logging
import math
import re
from typing import Any, Dict, List, Optional

from django.conf import settings
from temples.domain.extra_condition_tags import extract_extra_tags, split_tags_by_kind
from temples.domain.kyusei import kyusei_signals
from temples.llm import backfill as bf
from temples.services.concierge_candidate_normalize import normalize_candidate
from temples.services.concierge_explanation import attach_explanations_for_chat
from temples.services.concierge_observability import concierge_request_summary_log


def _max_address_lookups() -> int:
    try:
        v = int(os.getenv("CHAT_MAX_ADDRESS_LOOKUPS", "3"))
        return max(v, 0)
    except Exception:
        return 3


def _to_float(x: Any, default: float = 0.0) -> float:
    if x is None:
        return default
    if isinstance(x, (float, int)):
        return float(x)
    if isinstance(x, str):
        s = x.strip()
        return float(s) if s else default
    return default


def _none_if_blank(x: Any) -> Any:
    if x is None:
        return None
    if isinstance(x, str) and not x.strip():
        return None
    return x


log = logging.getLogger(__name__)


def _attach_engine_signals(
    recs: dict,
    *,
    llm_enabled: bool,
    orchestrator_used: bool,
    llm_error: Optional[str],
) -> None:
    if not isinstance(recs.get("_signals"), dict):
        recs["_signals"] = {}

    recs["_signals"]["llm"] = {
        "enabled": bool(llm_enabled),
        "used": bool(orchestrator_used),  # 互換: 「推薦エンジン呼んだ」
        "error": llm_error,
    }
    recs["_signals"]["engine"] = {
        "orchestrator_used": bool(orchestrator_used),
        "openai_enabled": bool(llm_enabled),
        "openai_used": bool(llm_enabled and orchestrator_used),
    }


CONTRACT_WEIGHTS_A = {"element": 0.6, "need": 0.3, "popular": 0.1}

DUMMY_NAMES = {"近隣の神社"}

FLOW_DEFINITIONS = {
    "A": {
        "description": "chat balanced recommendation",
        # ✅ Contract(test) expects these exact weights
        "weights": dict(CONTRACT_WEIGHTS_A),
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
    out: list[str] = []
    seen: set[str] = set()
    for v in values or []:
        s = str(v).strip()
        if not s:
            continue

        # keep original label
        if s not in seen:
            out.append(s)
            seen.add(s)

        # --- 互換: 地 <-> 土 を両方入れる（テスト/既存データ両対応） ---
        if s == "地" and "土" not in seen:
            out.append("土")
            seen.add("土")
        if s == "土" and "地" not in seen:
            out.append("地")
            seen.add("地")
        # ------------------------------------------------------------

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

    # ✅ 先に退避（dictじゃない場合もある）
    prev_result_state = None
    if isinstance(recs.get("_signals"), dict):
        prev_result_state = recs["_signals"].get("result_state")

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
    # --- kyusei (user flow) ---
    try:
        recs["_signals"]["kyusei"] = kyusei_signals(birthdate)
    except Exception as e:
        log.exception("[svc/chat] kyusei_signals failed birthdate=%r: %s", birthdate, e)
        recs["_signals"]["kyusei"] = None

    # ✅ 保険：result_state が消えてたら戻す（将来のsignals全置換事故に備える）
    if prev_result_state is not None and "result_state" not in recs["_signals"]:
        recs["_signals"]["result_state"] = prev_result_state


def _clean_display_name(name: Any) -> str:
    """(ダミー)などの補助フラグを表示から外す"""
    if not isinstance(name, str):
        return str(name)
    n = name.replace("(ダミー)", "").replace("（ダミー）", "")
    return n.strip()


def _key(n: str) -> str:
    return re.sub(r"\s+", "", _clean_display_name(n))


def _strip_suffix(s: str) -> str:
    for suf in ("神社", "神宮", "大社", "宮"):
        if s.endswith(suf) and len(s) > len(suf) + 2:
            return s[: -len(suf)]
    return s


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

    used = {_key((r.get("name") or "").strip()) for r in items if (r.get("name") or "").strip()}

    for c in candidates or []:
        if len(items) >= 3:
            break
        if not isinstance(c, dict):
            continue
        nm = (c.get("name") or "").strip()
        if not nm:
            continue
        nk = _key(nm)
        if nk in used:
            continue
        x = dict(c)
        x.setdefault("name", nm)
        x.setdefault("reason", "")
        items.append(x)
        used.add(nk)

    while len(items) < 3:
        if not allow_dummy:
            break
        items.append({"name": "近隣の神社", "reason": "", "is_dummy": True})

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

NEED_LABEL = {
    "career": "転機・仕事",
    "mental": "不安・心",
    "love": "恋愛",
    "money": "金運",
}

def _hint_from_need_tags(need_tags: list[str] | None) -> str | None:
    if not need_tags:
        return None
    key = str(need_tags[0])
    head = NEED_LABEL.get(key, key)
    return f"{head}に向き合う参拝に"

def _hint_from_need(rec: dict) -> str | None:
    bd = rec.get("breakdown")
    if not isinstance(bd, dict):
        return None
    matched = bd.get("matched_need_tags") or []
    if not matched:
        return None
    key = str(matched[0])
    head = NEED_LABEL.get(key, key)
    return f"{head}に向き合う参拝に"

def normalize_reason_for_chat(rec: dict, *, query: str, need_tags: list[str] | None = None) -> str:
    name = (rec.get("name") or "").strip()
    raw = rec.get("reason")
    t = raw.strip() if isinstance(raw, str) else ""

    tags_list = (rec.get("tags") or []) + (rec.get("deities") or [])
    tags = set(tags_list)

    try:
        popular = float(rec.get("popular_score") or 0)
    except Exception:
        popular = 0.0

    # 初期値（内部処理用）
    rec["reason_source"] = "raw"

    if t and t in TAG_DEITY_HINTS:
        t = TAG_DEITY_HINTS[t]
        rec["reason_source"] = "tag_deity_hint"

    if _is_noise_reason(t, name, "".join([str(x) for x in tags_list])):
        t = ""
        rec["reason_source"] = "noise_cleared"

    if not t:
        t = _hint_from_tags(tags) or ""
        if t:
            rec["reason_source"] = "tags"

    if not t:
        t = _hint_from_need_tags(need_tags) or ""
        if t:
            rec["reason_source"] = "need_tags"

    if not t:
        t = _hint_from_query(query) or ""
        if t:
            rec["reason_source"] = "query"

    if not t:
        t = _generic_by_popular(popular)
        rec["reason_source"] = "popular_generic"

    t = t[:30] if len(t) > 30 else t
    if not t:
        rec["reason_source"] = "fallback_static"

    # ✅ prefix 統一（集計しやすい形に揃える）
    src = rec.get("reason_source") or "unknown"
    rec["reason_source"] = f"reason:{src}"

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
            ["落ち着いて参拝しやすい", "混雑しにくい可能性", "雰囲気が希望に合う可能性"][
                len(bullets)
            ]
        )
    return bullets[:3]


def _dedupe_by_name(items: list[dict]) -> list[dict]:
    seen = set()
    out: list[dict] = []
    for r in items:
        name = (r.get("name") or "").strip()
        if not name:
            continue
        k = _key(name)  # ← ここが重要
        if k in seen:
            continue
        seen.add(k)
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

    used = {_key((r.get("name") or "").strip()) for r in items if (r.get("name") or "").strip()}

    for c in candidates or []:
        if len(items) >= size:
            break
        if not isinstance(c, dict):
            continue
        nm = (c.get("name") or "").strip()
        if not nm:
            continue
        nk = _key(nm)
        if nk in used:
            continue

        x = dict(c)
        x.setdefault("name", nm)
        x.setdefault("reason", "")
        items.append(x)
        used.add(nk)

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
        from temples.domain.astrology import element_code, element_priority, sun_sign_and_element
        from temples.models import Shrine
    except Exception as e:
        log.exception("[concierge][astro] import failed -> skip: %s", e)
        return recs

    prof = sun_sign_and_element(birthdate)
    if not prof:
        log.info(
            "[concierge][astro] sun_sign_and_element returned None -> skip birthdate=%r", birthdate
        )
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
        r["astro_matched"] = pri == 2

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
    # --- normalize astro_elements ---
    if isinstance(rec.get("astro_elements"), list):
        rec["astro_elements"] = _normalize_astro_elements(rec.get("astro_elements"))

    # --- element score ---
    pri_raw = rec.get("astro_priority")
    pri = int(pri_raw) if isinstance(pri_raw, int) else 0

    # birthdate があれば常に再計算（contract優先）
    if birthdate:
        try:
            from temples.domain.astrology import element_priority, sun_sign_and_element

            prof = sun_sign_and_element(birthdate)
            if prof:
                shrine_elems = rec.get("astro_elements") or []
                pri = int(element_priority(prof.element, shrine_elems))
        except Exception:
            pass

    score_element = int(pri)

    # --- need score: contract = need_tags ∩ shrine_astro_tags ---
    shrine_tags = rec.get("astro_tags") or []
    if not isinstance(shrine_tags, list):
        shrine_tags = []
    shrine_tags = [t for t in shrine_tags if isinstance(t, str) and t.strip()]
    shrine_tag_set = set(shrine_tags)

    need_tags = [t for t in (need_tags or []) if isinstance(t, str) and t.strip()]
    matched = [t for t in need_tags if t in shrine_tag_set]
    score_need = int(len(matched))

    # --- popular ---
    try:
        popular_f = float(rec.get("popular_score") or 0.0)
    except Exception:
        popular_f = 0.0
    score_popular = _clamp01(popular_f / 10.0)

    # --- weights ---
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
    rec["_score_total"] = float(score_total)

    rec["breakdown"] = {
        "score_element": int(score_element),
        "score_need": int(score_need),
        "score_popular": float(score_popular),
        "score_total": float(score_total),
        "weights": {"element": float(w1), "need": float(w2), "popular": float(w3)},
        "matched_need_tags": matched,
    }

    # （任意）詳細を残したいなら別キーへ。テスト契約からは外す。
    rec["breakdown_detail"] = {
        "version": 1,
        "features": {
            "element": {
                "raw": int(score_element),
                "weight": float(w1),
                "contribution": float(score_element * w1),
            },
            "need": {
                "raw": int(score_need),
                "weight": float(w2),
                "matched_tags": matched,
                "contribution": float(score_need * w2),
            },
            "popular": {
                "raw": float(score_popular),
                "weight": float(w3),
                "contribution": float(score_popular * w3),
            },
            "astro_bonus": float(astro_bonus) if astro_bonus_enabled else 0.0,
        },
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


def _use_llm() -> bool:
    """
    OpenAI無し運用のためのスイッチ。
    - settings.CONCIERGE_USE_LLM が True のときだけLLMを使う
    - 未設定なら False（安全側）
    """
    return bool(getattr(settings, "CONCIERGE_USE_LLM", False))


def _seed_recs_from_candidates(valid_candidates: list[dict], *, size: int = 3) -> dict:
    """
    LLMなしの初期推薦:
    - valid_candidates は距離順ソート済み前提
    """
    items: list[dict] = []
    for c in valid_candidates[:size]:
        if not isinstance(c, dict):
            continue
        nm = (c.get("name") or "").strip()
        if not nm:
            continue
        x = dict(c)
        x.setdefault("name", nm)
        x.setdefault("reason", "")
        items.append(x)
    return {"recommendations": _dedupe_by_name(items)}


def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    # 地球半径（m）
    R = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lng2 - lng1)

    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlmb / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def _fill_distance_m(candidates: list[dict], *, bias: Optional[dict]) -> None:
    """
    candidates の distance_m を bias(lat/lng) から補完する。
    - bias が無い/latlng無い場合は何もしない
    - candidate lat/lng が無い場合もスキップ
    - distance_m が既にあれば尊重
    """
    if not bias:
        return
    lat0 = bias.get("lat")
    lng0 = bias.get("lng")
    if lat0 is None or lng0 is None:
        return

    try:
        lat0 = float(lat0)
        lng0 = float(lng0)
    except Exception:
        return

    for c in candidates or []:
        if not isinstance(c, dict):
            continue
        if c.get("distance_m") is not None:
            continue
        lat = c.get("lat")
        lng = c.get("lng")
        if lat is None or lng is None:
            continue
        try:
            c["distance_m"] = float(_haversine_m(lat0, lng0, float(lat), float(lng)))
        except Exception:
            # 失敗しても黙ってスキップ（距離は補助情報）
            continue


def _has_addr(c: dict) -> bool:
    a = c.get("formatted_address") or c.get("address")
    return isinstance(a, str) and bool(a.strip())


def _match_candidate_for_name(
    *,
    nk: str,
    cand_by_key: dict[str, dict],
) -> tuple[Optional[dict], dict]:
    meta: dict = {"mode": "none", "near_key": None}

    # 1) direct
    c = cand_by_key.get(nk)
    if isinstance(c, dict):
        meta["mode"] = "direct"
        return c, meta

    # 2) stripped
    nk2 = _strip_suffix(nk)
    if nk2 and nk2 != nk:
        c = cand_by_key.get(nk2)
        if isinstance(c, dict):
            meta["mode"] = "stripped"
            meta["near_key"] = nk2
            return c, meta
    else:
        nk2 = ""

    # 3) near
    probe = nk2 or nk
    if not probe or len(probe) < 4:
        return None, meta

    keys = list(cand_by_key.keys())
    near_keys = [k for k in keys if probe in k]
    if not near_keys:
        return None, meta

    near_with_addr = [k for k in near_keys if _has_addr(cand_by_key.get(k, {}))]
    pool = near_with_addr
    if not pool:
        return None, meta

    def _rank(k: str) -> tuple[int, int, int, float]:
        exact = 0 if k == probe else 1
        prefix = 0 if k.startswith(probe) else 1
        len_diff = abs(len(k) - len(probe))
        dist = _to_float(cand_by_key.get(k, {}).get("distance_m"), 1e18)
        return (exact, prefix, len_diff, dist)

    pool.sort(key=_rank)
    best = pool[0]
    c = cand_by_key.get(best)
    if isinstance(c, dict):
        meta["mode"] = "near"
        meta["near_key"] = best
        return c, meta

    return None, meta


def _emit_obs_chat(
    final: dict,
    *,
    trace_id: str | None,
    query: str,
    requested_flow: str,
    effective_flow: str,
) -> None:
    """observability ログ（失敗してもパススルー）"""
    try:
        rs = (
            (final.get("_signals") or {}).get("result_state")
            if isinstance(final.get("_signals"), dict)
            else {}
        )
        stats_for_log = {
            "fallback_mode": (rs or {}).get("fallback_mode"),
            "matched_count": (rs or {}).get("matched_count"),
            "pool_count": (rs or {}).get("pool_count"),
            "displayed_count": (rs or {}).get("displayed_count"),
        }
        concierge_request_summary_log(
            endpoint="chat",
            trace_id=str(trace_id or ""),
            query_len=len(query or ""),
            flow_requested=str(requested_flow or ""),
            flow_effective=str(effective_flow or ""),
            stats=stats_for_log,
            recommendations=final.get("recommendations") or [],
        )
    except Exception:
        log.exception("[svc/chat] observability log failed (chat)")


# Contract:
# A) no candidates & no astro -> passthrough top3
# B) no candidates & astro_on -> astrology pool
# C) candidates present -> full flow
def build_chat_recommendations(  # noqa: C901
    *,
    query: str,
    language: str,
    candidates: List[Dict[str, Any]],
    bias: Optional[Dict[str, float]],
    birthdate: Optional[str],
    goriyaku_tag_ids: Optional[List[int]] = None,
    extra_condition: Optional[str] = None,
    flow: str = "A",  # "A" or "B"
    trace_id: str | None = None,
) -> Dict[str, Any]:
    """
    See: docs/concierge_spec.md
    """
    # ✅ リクエスト値を退避（後で flow を倒しても追跡できる）
    requested_flow = flow

    def _finalize_response(recs: dict, *, bias: Optional[dict]) -> dict:
        return attach_explanations_for_chat(
            recs,
            query=query,
            bias=bias,
            birthdate=birthdate,
            extra_condition=(extra_condition or "").strip() or None,
        )

    # 距離順 key（distance_m 無しは最後）
    def _cand_dist_key(c: dict) -> tuple[int, float]:
        d = c.get("distance_m")
        if d is None:
            return (1, 1e18)
        return (0, _to_float(d, 1e18))

    def _rec_dist_key(x: Any) -> tuple[int, float, str]:
        if not isinstance(x, dict):
            return (1, 1e18, "")
        d = x.get("distance_m")
        name = str(x.get("name") or "")
        if d is None:
            return (1, 1e18, name)
        return (0, _to_float(d, 1e18), name)

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

    raw_dicts = [c for c in (candidates or []) if isinstance(c, dict)]
    raw_total = len(raw_dicts)

    def _calc_missing_fields(cands: list[dict]) -> dict:
        total = len([c for c in cands if isinstance(c, dict)])
        if total == 0:
            return {
                "total": 0,
                "place_id": {"missing": 0, "rate": 0.0},
                "latlng": {"missing": 0, "rate": 0.0},
                "address": {"missing": 0, "rate": 0.0},
            }

        def _missing_place_id(c: dict) -> bool:
            v = c.get("place_id")
            return not (isinstance(v, str) and v.strip())

        def _missing_latlng(c: dict) -> bool:
            return c.get("lat") is None or c.get("lng") is None

        def _missing_address(c: dict) -> bool:
            a = c.get("formatted_address") or c.get("address")
            return not (isinstance(a, str) and a.strip())

        miss_place = sum(1 for c in cands if isinstance(c, dict) and _missing_place_id(c))
        miss_latlng = sum(1 for c in cands if isinstance(c, dict) and _missing_latlng(c))
        miss_addr = sum(1 for c in cands if isinstance(c, dict) and _missing_address(c))

        return {
            "total": total,
            "place_id": {"missing": miss_place, "rate": miss_place / total},
            "latlng": {"missing": miss_latlng, "rate": miss_latlng / total},
            "address": {"missing": miss_addr, "rate": miss_addr / total},
        }

    def _attach_stats(*, recs: dict, raw_total: int, valid_candidates: list[dict]) -> None:
        if not isinstance(recs.get("_signals"), dict):
            recs["_signals"] = {}

        # ✅ 既存statsを保持（location_fill 等を消さない）
        stats = recs["_signals"].get("stats")
        stats = stats if isinstance(stats, dict) else {}

        # result_state 由来の pool_count を拾う（無いなら0）
        rs = recs["_signals"].get("result_state")
        rs = rs if isinstance(rs, dict) else {}

        displayed = len([x for x in (recs.get("recommendations") or []) if isinstance(x, dict)])

        # ✅ 必要キーだけ上書き（merge）
        stats.update(
            {
                "candidate_count": int(raw_total),
                "valid_candidate_count": int(len(valid_candidates)),
                "pool_count": int(rs.get("pool_count") or 0),
                "displayed_count": int(displayed),
                "missing_fields": _calc_missing_fields(valid_candidates),
            }
        )

        recs["_signals"]["stats"] = stats

    # 0. candidates 正規化（入口で一度だけ）
    candidates = _normalize_candidates_for_chat(candidates)

    def _is_test_candidate(c: dict) -> bool:
        try:
            if int(c.get("shrine_id") or 0) == 1:
                return True
        except Exception:
            pass
        name = str(c.get("name") or "")
        addr = str(c.get("address") or "") + " " + str(c.get("formatted_address") or "")
        if "テスト" in name:
            return True
        if "東京都テスト区" in addr:
            return True
        return False

    valid_candidates = [
        c
        for c in candidates
        if isinstance(c, dict) and (c.get("name") or "").strip() and not _is_test_candidate(c)
    ]

    normalized_total = len([c for c in (candidates or []) if isinstance(c, dict)])
    log.info(
        "[svc/chat] trace=%s stage=candidates raw=%d normalized=%d valid=%d astro_on=%s bias=%s/%s",
        trace_id,
        raw_total,
        normalized_total,
        len(valid_candidates),
        "Y" if _astro_enabled(birthdate) else "N",
        "Y" if (bias and bias.get("lat") is not None) else "N",
        "Y" if (bias and bias.get("lng") is not None) else "N",
    )

    # bias が無いなら candidates から合成（最低限 lat/lng を作る）
    if (not bias or bias.get("lat") is None or bias.get("lng") is None) and valid_candidates:
        c0 = next(
            (c for c in valid_candidates if c.get("lat") is not None and c.get("lng") is not None),
            None,
        )
        if c0:
            # view から来る形に寄せる（radius は適当でOK）
            bias = {
                "lat": float(c0["lat"]),
                "lng": float(c0["lng"]),
                "radius": 8000.0,
                "radius_m": 8000.0,
            }
            log.info("[svc/chat] bias synthesized from candidates: %r", bias)

    # ✅ bias があるなら常に距離補完（ここが大事）
    if bias and bias.get("lat") is not None and bias.get("lng") is not None:
        _fill_distance_m(valid_candidates, bias=bias)
    else:
        log.info("[svc/chat] distance_fill skipped (no bias)")

    # 距離順（distance_m 無しは最後）
    valid_candidates.sort(key=_cand_dist_key)

    dist_sample = [c.get("distance_m") for c in valid_candidates[:5]]
    log.info(
        "[svc/chat] dist_sample=%r birthdate=%r goriyaku=%r extra=%r query=%r candidates=%d",
        dist_sample,
        birthdate,
        goriyaku_tag_ids,
        extra_condition,
        (query or "")[:40],
        len(candidates or []),
    )

    # 2. LLMで初期推薦を取得（LLM無効なら呼ばない）
    llm_enabled = _use_llm()

    llm_used = False
    llm_error = None

    if llm_enabled:
        try:
            from temples.llm import orchestrator as orch_mod

            llm_used = True  # enabled=true で suggest() を試行した事実
            recs = orch_mod.ConciergeOrchestrator().suggest(
                query=query,
                candidates=valid_candidates,
            )
        except Exception as e:
            llm_error = f"{type(e).__name__}: {e}"
            recs = _seed_recs_from_candidates(valid_candidates, size=3)
    else:
        recs = _seed_recs_from_candidates(valid_candidates, size=3)

    if isinstance(recs, list):
        recs = {"recommendations": recs}
    if not isinstance(recs, dict):
        recs = {"recommendations": []}
    if "recommendations" not in recs or recs["recommendations"] is None:
        recs["recommendations"] = []

    # --- ✅ TEST ONLY: 1件だけ末尾に「神社」を足して suffix 揺れを発火させる ---
    # 使い方: CONCIERGE_DEBUG_FORCE_SUFFIX=1 を付けて起動
    if os.getenv("CONCIERGE_DEBUG_FORCE_SUFFIX") == "1":
        try:
            items = recs.get("recommendations") or []
            if isinstance(items, list) and items and isinstance(items[0], dict):
                before = items[0].get("name")
                items[0]["name"] = (str(before or "") + "神社").strip()
                log.info(
                    "[svc/chat] DEBUG_FORCE_SUFFIX applied name %r -> %r",
                    before,
                    items[0].get("name"),
                )
        except Exception:
            log.exception("[svc/chat] DEBUG_FORCE_SUFFIX failed")

    # Orchestrator結果を正規化（dedupe）
    items0 = recs.get("recommendations") or []
    items0 = [r for r in items0 if isinstance(r, dict)]
    items0 = [r for r in items0 if not _is_test_candidate(r)]
    items0 = _dedupe_by_name(items0)

    for r in items0:
        for k in ("place_id", "shrine_id", "location", "address", "formatted_address", "name"):
            if k in r:
                r[k] = _none_if_blank(r.get(k))

    recs["recommendations"] = _dedupe_by_name(items0)

    # birthdate の妥当性（astro on/off）
    astro_on = _astro_enabled(birthdate)

    # flow=B なのに birthdate 無効なら A に倒す（contract簡略）
    if flow == "B" and not astro_on:
        flow = "A"

    # debugに最終値を入れる
    recs["_debug"] = recs.get("_debug") if isinstance(recs.get("_debug"), dict) else {}
    recs["_debug"]["trace_id"] = trace_id
    recs["_debug"]["requested_flow"] = requested_flow
    recs["_debug"]["flow"] = flow

    # ✅ ここで return しない。Step3 以降に続ける。

    # 3. need（ご利益タグ）抽出
    _need = _extract_need(query)
    if isinstance(_need, dict):
        recs["_need"] = _need

    # 3.5 extra_condition（自由文）を辞書タグ化
    sort_tags: set[str] = set()
    try:
        ex = extract_extra_tags(extra_condition or "", max_tags=3)
        kinds = split_tags_by_kind(ex.tags)
        hits_raw = getattr(ex, "hits", None)
        hits: dict[str, Any] = hits_raw if isinstance(hits_raw, dict) else {}

        tags_raw = getattr(ex, "tags", [])
        tags_list = list(tags_raw) if isinstance(tags_raw, (list, tuple, set)) else []

        recs["_extra"] = {"tags": tags_list, "hits": hits, "kinds": kinds}
        sort_tags = set(kinds.get("sort_override") or [])
    except Exception:
        recs["_extra"] = {
            "tags": [],
            "hits": {},
            "kinds": {"sort_override": [], "hard_filter": [], "soft_signal": [], "unknown": []},
        }
        sort_tags = set()

    # 4. 候補プール（astro_onなら広めに）
    pre_limit = 12 if astro_on else 3
    recs = _ensure_pool_size(recs, candidates=valid_candidates, size=pre_limit)

    # 候補は正規化キーで1回だけ引けるようにして、以降の補完で共通利用する
    cand_by_key: dict[str, dict] = {}
    for c in valid_candidates:
        nm = (c.get("name") or "").strip()
        if not nm:
            continue
        k = _key(nm)
        # ✅ 近い候補（先に来る）を保持。後続で上書きしない
        if k not in cand_by_key:
            cand_by_key[k] = c

    max_lookups = _max_address_lookups()
    log.info(
        "[svc/chat] valid_candidates sample=%r", [c.get("name") for c in valid_candidates[:10]]
    )

    # -----------------------------
    # Step5/6: 候補補完 + location埋め（安定版）
    # -----------------------------
    lookup_addr_cache: dict[str, Optional[str]] = {}

    cand_addr: dict[str, str] = {}
    cand_addr_stripped: dict[str, str] = {}

    for nk, c in cand_by_key.items():
        addr = c.get("formatted_address") or c.get("address")
        if not (isinstance(addr, str) and addr.strip()):
            continue

        a = addr.strip()
        cand_addr[nk] = a

        nk2 = _strip_suffix(nk)
        if nk2 and nk2 != nk and nk2 not in cand_addr_stripped:
            cand_addr_stripped[nk2] = a

    cand_hit = 0
    cache_hit = 0
    bf_called = 0
    miss = 0
    eligible = 0
    near_info_emitted = 0
    cand_keys = tuple(cand_by_key.keys())

    for r in recs.get("recommendations", []) or []:
        if not isinstance(r, dict):
            continue

        nm = (r.get("name") or "").strip()
        if not nm:
            continue

        nk = _key(nm)
        matched_c, _ = _match_candidate_for_name(nk=nk, cand_by_key=cand_by_key)
        c = matched_c

        # -----------------------------
        # Step6: 候補情報の補完
        # -----------------------------
        if isinstance(c, dict):
            if not r.get("place_id") and c.get("place_id"):
                r["place_id"] = c.get("place_id")

            if not r.get("shrine_id") and c.get("shrine_id"):
                r["shrine_id"] = c.get("shrine_id")

            if r.get("lat") is None and c.get("lat") is not None:
                r["lat"] = c.get("lat")

            if r.get("lng") is None and c.get("lng") is not None:
                r["lng"] = c.get("lng")

            if r.get("distance_m") is None and c.get("distance_m") is not None:
                r["distance_m"] = c.get("distance_m")

            addr2 = c.get("formatted_address") or c.get("address")
            if r.get("address") is None and isinstance(addr2, str) and addr2.strip():
                r["address"] = addr2.strip()

            if r.get("goriyaku_tag_ids") is None and c.get("goriyaku_tag_ids") is not None:
                r["goriyaku_tag_ids"] = c.get("goriyaku_tag_ids")

            if r.get("popular_score") is None and c.get("popular_score") is not None:
                r["popular_score"] = c.get("popular_score")

        # -----------------------------
        # Step5: location 補完
        # -----------------------------
        loc = r.get("location")
        if isinstance(loc, str) and loc.strip():
            continue

        if r.get("is_dummy") is True or nm in DUMMY_NAMES:
            continue

        eligible += 1
        addr: Optional[str] = None

        # 1) 直接キー
        addr = cand_addr.get(nk)

        # 1.5) suffix救済
        if not addr:
            nk2 = _strip_suffix(nk)
            if nk2 and nk2 != nk:
                addr = cand_addr_stripped.get(nk2)

        # 1.6) match済み candidate からゼロコスト取得
        if not addr and isinstance(c, dict):
            a2 = c.get("formatted_address") or c.get("address")
            if isinstance(a2, str) and a2.strip():
                addr = a2.strip()

        # 2) near救済
        if not addr:
            miss += 1
            probe = _strip_suffix(nk) or nk
            near_key = None
            near = []

            if probe and len(probe) >= 4:
                try:
                    near = [k for k in cand_keys if probe in k]

                    near_with_addr = [
                        k
                        for k in near
                        if (k in cand_addr) or (_strip_suffix(k) in cand_addr_stripped)
                    ]

                    def _near_rank(k: str) -> tuple[int, int, int]:
                        exact = 0 if k == probe else 1
                        prefix = 0 if k.startswith(probe) else 1
                        len_diff = abs(len(k) - len(probe))
                        return (exact, prefix, len_diff)

                    pool = near_with_addr or near
                    if pool:
                        pool.sort(key=_near_rank)
                        near_key = pool[0]
                except Exception:
                    near_key = None

            if near_key:
                addr = cand_addr.get(near_key) or cand_addr_stripped.get(_strip_suffix(near_key))

                if not addr:
                    c_near = cand_by_key.get(near_key)
                    if isinstance(c_near, dict):
                        a2 = c_near.get("formatted_address") or c_near.get("address")
                        if isinstance(a2, str) and a2.strip():
                            addr = a2.strip()

                if near_info_emitted < 3:
                    log.info(
                        "[svc/chat] miss near_keys used=%s name=%r probe=%r near_key=%r",
                        "Y" if addr else "N",
                        nm,
                        probe,
                        near_key,
                    )
                    near_info_emitted += 1

        # 3) cache/BF
        if not addr:
            ck = f"{nk}|lang={language}"

            if ck in lookup_addr_cache:
                cache_hit += 1
                addr = lookup_addr_cache.get(ck)
            else:
                if bf_called < max_lookups:
                    bf_called += 1
                    try:
                        addr = bf._lookup_address_by_name(nm, bias=bias, lang=language)
                    except Exception:
                        addr = None
                lookup_addr_cache[ck] = addr

        # -----------------------------
        # location 反映
        # -----------------------------
        if isinstance(addr, str) and addr.strip():
            cand_hit += 1
            a = addr.strip()
            try:
                r["location"] = bf._shorten_japanese_address(a) or a
            except Exception:
                r["location"] = a

        # stats 更新
        if not isinstance(recs.get("_signals"), dict):
            recs["_signals"] = {}
        stats = recs["_signals"].get("stats") or {}

        stats["location_fill"] = {
            "eligible": eligible,
            "cand_hit": cand_hit,
            "miss": miss,
            "bf_called": bf_called,
            "cache_hit": cache_hit,
        }
        recs["_signals"]["stats"] = stats

    # -----------------------------
    # Step7. ユーザーフィルタ（痩せ検知ログ）
    # -----------------------------
    before_filters = len([x for x in (recs.get("recommendations") or []) if isinstance(x, dict)])
    try:
        recs = _apply_user_filters(
            recs, goriyaku_tag_ids=goriyaku_tag_ids, extra_condition=extra_condition
        )
    except Exception:
        pass
    after_filters = len([x for x in (recs.get("recommendations") or []) if isinstance(x, dict)])
    log.info(
        "[svc/chat] filters applied before=%d after=%d goriyaku=%r extra=%r",
        before_filters,
        after_filters,
        goriyaku_tag_ids,
        (extra_condition or "").strip() or None,
    )

    current_pool = len([x for x in (recs.get("recommendations") or []) if isinstance(x, dict)])

    # ★追加: 0件だった事実をUIへ伝える（フォールバック表示の根拠）
    if not isinstance(recs.get("_signals"), dict):
        recs["_signals"] = {}

    if after_filters == 0:
        extra = (extra_condition or "").strip() or None
        msg = "条件に一致する神社が見つかりませんでした（0件）"
        if extra:
            msg = f"「{extra}」に一致する神社が見つかりませんでした（0件）"

        recs["_signals"]["result_state"] = {
            "matched_count": 0,
            "pool_count": current_pool,
            "displayed_count": None,
            "fallback_mode": "nearby_unfiltered",
            "fallback_reason_ja": msg,
            "ui_disclaimer_ja": "代わりに近い神社を表示しています（条件は反映されていません）",
            "requested_extra_condition": extra,
        }
    else:
        # 0件じゃないときも一応入れておくとUIが安定する（任意）
        recs["_signals"]["result_state"] = {
            "matched_count": after_filters,
            "pool_count": current_pool,
            "displayed_count": None,
            "fallback_mode": "none",
            "fallback_reason_ja": None,
            "ui_disclaimer_ja": None,
            "requested_extra_condition": (extra_condition or "").strip() or None,
        }

    try:
        recs = _ensure_pool_size(recs, candidates=valid_candidates, size=pre_limit)
    except Exception:
        log.exception("[concierge] _ensure_pool_size after filters crashed -> continue")

    # -----------------------------
    # 8. 占星術（astro_onのみ）
    # -----------------------------
    if pre_limit >= 12:
        try:
            recs = _maybe_apply_astrology(recs, birthdate=birthdate)
        except Exception:
            log.exception("[concierge][astro] _maybe_apply_astrology crashed -> continue")

    # -----------------------------
    # 9. スコアリング（flow weights）
    # -----------------------------
    flow_def = FLOW_DEFINITIONS.get(flow, FLOW_DEFINITIONS["A"])
    WEIGHTS = dict(flow_def["weights"])
    astro_bonus_enabled = bool(flow_def["astro_bonus_enabled"])
    mode_weights = dict(WEIGHTS)

    need_tags = list((recs.get("_need") or {}).get("tags") or [])
    need_tags = [t for t in need_tags if isinstance(t, str) and t.strip()]

    # 1) 先に breakdown を全件に付与
    for r in recs.get("recommendations", []) or []:
        if not isinstance(r, dict):
            continue
        _attach_breakdown(
            r,
            birthdate=birthdate,
            need_tags=need_tags,
            weights=WEIGHTS,
            astro_bonus_enabled=astro_bonus_enabled,
        )

    # 2) fallback 状態を先に確定（この後のソート判断に使う）
    rs = (
        recs.get("_signals", {}).get("result_state")
        if isinstance(recs.get("_signals"), dict)
        else None
    )
    force_distance = "sort_distance" in sort_tags
    fallback_distance = isinstance(rs, dict) and rs.get("fallback_mode") == "nearby_unfiltered"
    distance_mode = force_distance or fallback_distance

    # 3) ログは1回だけ（top5の状態確認）
    try:
        top = [x for x in (recs.get("recommendations") or []) if isinstance(x, dict)][:5]
        log.info(
            "[svc/chat] score_debug top=%r",
            [
                {
                    "name": x.get("name"),
                    "astro_priority": x.get("astro_priority"),
                    "popular_score": x.get("popular_score"),
                    "_score_total": x.get("_score_total"),
                    "distance_m": x.get("distance_m"),
                    "has_breakdown": isinstance(x.get("breakdown"), dict),
                }
                for x in top
            ],
        )
    except Exception:
        pass

    log.info("[svc/chat] sort_mode=%s", "distance" if distance_mode else "score")

    def _score_key(rec: Any) -> tuple[float, float, int, str]:
        if not isinstance(rec, dict):
            return (0.0, 1e18, 0, "")
        score = _to_float(rec.get("_score_total"), 0.0)
        dist = _to_float(rec.get("distance_m"), 1e18)
        astro = int(rec.get("astro_priority") or 0)
        name = str(rec.get("name") or "")
        return (-score, dist, -astro, name)

    # -----------------------------
    # 10. lat/lng必須（ただし3件未満になるならスキップ）: 痩せ検知ログ
    # -----------------------------
    if valid_candidates:
        before_geo = list(recs.get("recommendations") or [])
        before_geo_n = len([x for x in before_geo if isinstance(x, dict)])
        filtered = [
            r
            for r in (recs.get("recommendations") or [])
            if isinstance(r, dict) and r.get("lat") is not None and r.get("lng") is not None
        ]
        filtered_n = len(filtered)
        recs["recommendations"] = filtered if filtered_n >= 3 else before_geo
        log.info(
            "[svc/chat] geo_filter before=%d after=%d applied=%s",
            before_geo_n,
            filtered_n,
            "yes" if filtered_n >= 3 else "no(kept_before)",
        )

    # -----------------------------
    # 11. 最終3件確定（痩せ検知ログ）
    # -----------------------------
    pool_all = [x for x in (recs.get("recommendations") or []) if isinstance(x, dict)]
    pool_n = len(pool_all)

    log.info("[svc/chat] finalize_3 enter pool=%d", pool_n)

    if isinstance(recs.get("_signals"), dict) and isinstance(
        recs["_signals"].get("result_state"), dict
    ):
        recs["_signals"]["result_state"]["pool_count"] = pool_n

    filled = 0  # breakdown backfill 件数（ログ用）

    # ★ 3件未満のときだけ補完
    if pool_n < 3:
        recs = _finalize_3(recs, candidates=valid_candidates, allow_dummy=False)

        if isinstance(recs.get("_signals"), dict) and isinstance(
            recs["_signals"].get("result_state"), dict
        ):
            recs["_signals"]["result_state"]["displayed_count"] = len(
                [x for x in (recs.get("recommendations") or []) if isinstance(x, dict)]
            )

        # finalize_3 で追加された分だけ breakdown 補完
        for r in recs.get("recommendations") or []:
            if isinstance(r, dict) and not isinstance(r.get("breakdown"), dict):
                _attach_breakdown(
                    r,
                    birthdate=birthdate,
                    need_tags=need_tags,
                    weights=WEIGHTS,
                    astro_bonus_enabled=astro_bonus_enabled,
                )
                filled += 1

    items = recs.get("recommendations") or []
    log.info("[svc/chat] breakdown backfilled=%d", filled)
    log.info("[svc/chat] finalize_3 exit items=%d", len([x for x in items if isinstance(x, dict)]))

    if distance_mode:
        recs["recommendations"] = sorted(
            [r for r in (recs.get("recommendations") or []) if isinstance(r, dict)],
            key=_rec_dist_key,
        )
    else:
        recs["recommendations"] = sorted(
            [r for r in (recs.get("recommendations") or []) if isinstance(r, dict)],
            key=_score_key,  # ✅ reverse=True は付けない
        )

    # ✅ ソート（または距離順）確定後の items を取り直す（ズレ防止）
    items = recs.get("recommendations") or []

    log.info(
        "[svc/chat] top3 after final sort: %r",
        [
            (r.get("name"), r.get("_score_total"), r.get("distance_m"))
            for r in (recs.get("recommendations") or [])[:3]
        ],
    )

    def _prepend_unique(xs: list[str], s: str) -> list[str]:
        if s in xs:
            xs.remove(s)
        return [s] + xs

    # ✅ 表示対象を recommendations 本体で 3件に確定（混在防止）
    recs["recommendations"] = [
        r for r in (recs.get("recommendations") or []) if isinstance(r, dict)
    ][:3]

    if isinstance(recs.get("_signals"), dict) and isinstance(
        recs["_signals"].get("result_state"), dict
    ):
        recs["_signals"]["result_state"]["displayed_count"] = len(recs["recommendations"])

    items = recs["recommendations"]


    # 12. 表示用整形
    soft_tags = set(((recs.get("_extra") or {}).get("kinds") or {}).get("soft_signal") or [])

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

        # --- Step12: reason ---
        matched = []
        bd = r.get("breakdown")
        if isinstance(bd, dict):
            matched = bd.get("matched_need_tags") or []

        if matched:
            # ✅ 意図統一: 元データの reason を捨てて UI理由を作る
            r.pop("reason", None)

            label = {
                "career": "転機・仕事",
                "mental": "不安・心",
                "love": "恋愛",
                "money": "金運",
            }
            head = label.get(str(matched[0]), str(matched[0]))
            r["reason"] = f"{head}に向き合う参拝に"
            r["reason_source"] = "reason:matched_need_tags"
        else:
            try:
                r.pop("reason", None)
                r["reason"] = normalize_reason_for_chat(r, query=query, need_tags=need_tags)
                # normalize_reason_for_chat が reason_source を reason:* にしてくれる
            except Exception:
                r["reason"] = "静かに手を合わせたい社"
                r["reason_source"] = "reason:fallback_static"

        # soft_signal を highlights へ注入（スコアはいじらない）
        if soft_tags:
            hs = r.get("highlights")
            if not isinstance(hs, list):
                hs = []

            if "energize" in soft_tags:
                hs = _prepend_unique(hs, "前向きさ・活力を後押ししやすい雰囲気")
            if "calm" in soft_tags:
                hs = _prepend_unique(hs, "落ち着いて気持ちを整えやすい雰囲気")

            r["highlights"] = hs[:3]

        try:
            r["bullets"] = build_bullets_for_chat(r, query=query)
        except Exception:
            r["bullets"] = [
                "落ち着いて参拝しやすい",
                "混雑しにくい可能性",
                "雰囲気が希望に合う可能性",
            ]

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

    # --- UI向け: message を必ず返す（LLM無しでも喋る） ---
    if not isinstance(recs.get("message"), str) or not recs["message"].strip():
        top_names: list[str] = []
        for r in items:
            nm = (r.get("display_name") or r.get("name") or "").strip()
            if nm:
                top_names.append(nm)

        if top_names:
            recs["message"] = (
                f"相談内容と近さをもとに、参拝候補を3件に整理しました。（{', '.join(top_names)}）"
            )
        else:
            recs["message"] = (
                "条件に合いそうな神社が見つかりませんでした。条件を少しゆるめて試してください。"
            )

    # --- デバッグ: LLM利用状況 ---
    _attach_engine_signals(
        recs,
        llm_enabled=llm_enabled,
        orchestrator_used=llm_used,
        llm_error=llm_error,
    )

    _attach_stats(recs=recs, raw_total=raw_total, valid_candidates=valid_candidates)

    # explanation付与前
    log.info(
        "[svc/chat] before_expl top3=%r",
        [
            {
                "name": r.get("name"),
                "has_explanation": bool(r.get("explanation")),
                "reason": r.get("reason"),
                "bullets": r.get("bullets"),
                "distance_m": r.get("distance_m"),
            }
            for r in (recs.get("recommendations") or [])
            if isinstance(r, dict)
        ],
    )

    # ✅ ここ（最後）でだけ finalize + observability + return
    final = _finalize_response(recs, bias=bias)

    # explanation付与後
    log.info(
        "[svc/chat] after_expl top3=%r",
        [
            {
                "name": r.get("name"),
                "has_explanation": bool(r.get("explanation")),
                "reason_count": len((r.get("explanation") or {}).get("reasons") or []),
            }
            for r in (final.get("recommendations") or [])
            if isinstance(r, dict)
        ],
    )
    _emit_obs_chat(
        final, trace_id=trace_id, query=query, requested_flow=requested_flow, effective_flow=flow
    )
    return final
