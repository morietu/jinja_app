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


# api_views_concierge.py と同一の固定辞書（挙動維持のため）
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
    """
    短文の“推し文”を最終整形。chat用（api_views の挙動と合わせる）
    - タグ/クエリからヒント
    - ノイズ除去
    - popular_score による汎用文
    """
    name = (rec.get("name") or "").strip()
    raw = rec.get("reason")
    t = raw.strip() if isinstance(raw, str) else ""

    tags_list = (rec.get("tags") or []) + (rec.get("deities") or [])
    tags = set(tags_list)
    popular = float(rec.get("popular_score") or 0)

    # ノイズ除去／キー直接一致置換
    if t and t in TAG_DEITY_HINTS:
        t = TAG_DEITY_HINTS[t]
    if _is_noise_reason(t, name, "".join(tags_list)):
        t = ""

    # タグ→クエリ
    if not t:
        t = _hint_from_tags(tags) or ""
    if not t:
        t = _hint_from_query(query) or ""

    # 人気スコア汎用文
    if not t:
        t = _generic_by_popular(popular)

    t = t[:30] if len(t) > 30 else t
    return t or "静かに手を合わせたい社"


def build_bullets_for_chat(rec: dict, *, query: str) -> list[str]:
    """
    UI表示用の補足 bullets（会話文ではなく“評価理由”）
    - rec.bullets / rec.highlights を最優先
    - 無ければ query/tags から軽く推測
    - 最低3つ保証
    """
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
    out = []
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

    # dict以外を除去しつつ正規化
    items = [x for x in items if isinstance(x, dict)]
    items = _dedupe_by_name(items)

    if len(items) >= limit:
        recs["recommendations"] = items
        return recs

    # candidatesから不足分を補充
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
    """
    占星術フィルタ（軽量化のため lazy import + birthdate がある時だけ）
    - import が重い/失敗する環境でも chat 全体は落とさない
    - Shrine 参照もここに閉じ込める
    """
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

    ELEMENT_LABEL_JA = {
        "fire": "火",
        "water": "水",
        "earth": "地",
        "air": "風",
    }

    items = recs.get("recommendations") or []
    if not isinstance(items, list) or not items:
        return recs

    # astro_elements を埋める（無ければ空）
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

    # 優先度で最大3件に絞る（2→1→0）
    only_dicts = [r for r in items if isinstance(r, dict)]
    buckets: Dict[int, List[dict]] = {2: [], 1: [], 0: []}
    for r in only_dicts:
        pri = element_priority(prof.element, r.get("astro_elements"))

        r["astro_priority"] = int(pri)
        r["astro_matched"] = bool(pri == 2)
        buckets[pri].append(r)

    picked: List[dict] = []
    for pri in (2, 1, 0):
        for r in buckets[pri]:
            if len(picked) >= 3:
                break
            picked.append(r)
        if len(picked) >= 3:
            break

    recs["recommendations"] = picked

    # --- 追加: contract固定用の _astro 拡張（既存キーは残す）---
    picked_names = [
        (x.get("name") if isinstance(x, dict) else None) for x in picked
    ]
    picked_names = [n for n in picked_names if isinstance(n, str) and n.strip()]

    element = prof.element
    label_ja = ELEMENT_LABEL_JA.get(element, element)

    recs["_astro"] = {
        "sun_sign": prof.sign,
        "element": element,
        "label_ja": label_ja,
        "matched_count": len(picked_names),
        "picked": picked_names,
        "reason": f"{label_ja}の気質に寄せて上位を選びました",
    }

    return recs



# ---- Need tags / scoring ----
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
    """
    contract固定:
      return {"tags": [...], "hits": {...}} を必ず返す（例外時も空）
    """
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
        # hits の value は list[str] を想定（壊れてても落とさない）
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


def _clamp01(x: float) -> float:
    if x < 0:
        return 0.0
    if x > 1:
        return 1.0
    return float(x)


def _attach_breakdown(
    rec: Dict[str, Any],
    *,
    birthdate: Optional[str],
    need_tags: List[str],
    weights: Dict[str, float],
) -> None:
    """
    contract固定:
      rec["breakdown"] = {
        score_element: int(0/1/2),
        score_need: int,
        score_popular: float(0..1),
        score_total: float,
        weights: {element, need, popular},
        matched_need_tags: [..],
      }
    """
    # 1) score_element
    score_element = 0
    try:
        # birthdate が無い/不正なら element_priority の評価は 0 に寄せる
        if birthdate:
            from temples.domain.astrology import sun_sign_and_element, element_priority
            prof = sun_sign_and_element(birthdate)
            if prof:
                shrine_elems = rec.get("astro_elements") or []
                score_element = int(element_priority(prof.element, shrine_elems))
    except Exception:
        score_element = int(rec.get("astro_priority") or 0) if isinstance(rec.get("astro_priority"), int) else 0

    # 2) score_need / matched_need_tags
    shrine_tags = rec.get("astro_tags") or []
    if not isinstance(shrine_tags, list):
        shrine_tags = []
    shrine_tags = [t for t in shrine_tags if isinstance(t, str) and t.strip()]

    # need_tags 側も安全化
    if not isinstance(need_tags, list):
        need_tags = []
    need_tags = [t for t in need_tags if isinstance(t, str) and t.strip()]

    matched = [t for t in need_tags if t in set(shrine_tags)]
    score_need = int(len(matched))

    # 3) score_popular
    popular = rec.get("popular_score")
    try:
        popular_f = float(popular) if popular is not None else 0.0
    except Exception:
        popular_f = 0.0
    score_popular = _clamp01(popular_f / 10.0)

    # 4) total
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


def _need_score_and_matches(need_tags: list[str], shrine_tags: list[str] | None) -> tuple[int, list[str]]:
    """
    最小構成:
      - score_need = 交差の件数
      - matched_need_tags = 交差タグ（need_tags順を維持）
    """
    if not need_tags:
        return 0, []
    st = shrine_tags or []
    st_set = {str(x).strip() for x in st if str(x).strip()}
    matched = [t for t in need_tags if t in st_set]
    return len(matched), matched


def _element_score_from_rec(rec: dict, *, birthdate: str | None) -> int:
    """
    contract固定:
      score_element = element_priority(user_elem, rec.astro_elements) => 0/1/2
    """
    if not birthdate:
        return 0
    try:
        from temples.domain.astrology import sun_sign_and_element, element_priority
    except Exception:
        return 0
    prof = sun_sign_and_element(birthdate)
    if not prof:
        return 0
    try:
        return int(element_priority(prof.element, rec.get("astro_elements")))
    except Exception:
        return 0


def _popular_score_norm(rec: dict) -> float:
    """
    contract固定:
      score_popular = clamp(popular_score/10)
    """
    try:
        p = float(rec.get("popular_score") or 0.0)
    except Exception:
        p = 0.0
    return _clamp01(p / 10.0)




def build_chat_recommendations(
    *,
    query: str,
    language: str,
    candidates: List[Dict[str, Any]],
    bias: Optional[Dict[str, float]],
    birthdate: Optional[str],
) -> Dict[str, Any]:
    """
    /api/concierge/chat の推薦パイプライン（APIViewを薄く保つための service）
    - Orchestratorで候補生成（失敗時はfallback）
    - candidates formatted_address を最優先で location に入れる → それでも無いなら backfill lookup
    - birthdate があれば占星術フィルタ（lazy import）
    - 3件固定
    - display_name / reason / bullets を確定
    """
    # ---- recommendations 生成（tests monkeypatch が効く import を使う）----
    try:
        from temples.llm.orchestrator import ConciergeOrchestrator as Orchestrator

        recs: Any = Orchestrator().suggest(query=query, candidates=candidates)
    except Exception:
        recs = {"recommendations": []}

    # 正規化
    if isinstance(recs, list):
        recs = {"recommendations": recs}
    if not isinstance(recs, dict):
        recs = {"recommendations": []}
    if "recommendations" not in recs or recs["recommendations"] is None:
        recs["recommendations"] = []

    # ---- need extraction（contract用：常に dict を返せたら _need を載せる）----
    _need = _extract_need(query)
    if isinstance(_need, dict):
        recs["_need"] = _need
        

    # 空なら fallback 1件（IndexError 回避）
    if not recs["recommendations"]:
        if candidates and isinstance(candidates[0], dict) and candidates[0].get("name"):
            recs["recommendations"] = [{"name": candidates[0]["name"], "reason": ""}]
        else:
            recs["recommendations"] = [{"name": "近隣の神社", "reason": ""}]

    # ✅ Orchestrator が少数しか返さない時でも、candidates で最大3件まで補充（比較できる状態にする）
    recs = _topup_recommendations_with_candidates(recs, candidates=candidates, limit=3)

    # candidates の formatted_address を最優先で location に入れる
    cand_addr: dict[str, str] = {}
    for c in candidates or []:
        if isinstance(c, dict) and c.get("name") and c.get("formatted_address"):
            cand_addr[(c["name"] or "").strip()] = c["formatted_address"]

    # --- location 補完 ---
    for r in recs.get("recommendations", []) or []:
        if not isinstance(r, dict):
            continue
        if r.get("location"):
            continue

        nm = (r.get("name") or "").strip()

        if nm in cand_addr:
            addr = cand_addr[nm]
            try:
                r["location"] = bf._shorten_japanese_address(addr) or addr
            except Exception:
                r["location"] = addr
            continue

        # fallback: lookup
        try:
            addr = bf._lookup_address_by_name(nm, bias=bias, lang=language)
        except Exception:
            addr = None
        if addr:
            try:
                r["location"] = bf._shorten_japanese_address(addr) or addr
            except Exception:
                r["location"] = addr

    # --- astrology filter（birthdateがある時だけ）---
    try:
        recs = _maybe_apply_astrology(recs, birthdate=birthdate)
    except Exception:
        pass

    # ✅ 最後に slice で 3件固定
    try:
        recs["recommendations"] = recs["recommendations"][:3]
    except Exception:
        pass


    # ---- breakdown（contract用）----
    # Wはcontractで固定（後で調整するときはテストも一緒に更新）
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
            # breakdown は“無いよりマシ”なので、最悪でも空で入れる
            r["breakdown"] = {
                "score_element": 0,
                "score_need": 0,
                "score_popular": 0.0,
                "score_total": 0.0,
                "weights": dict(WEIGHTS),
                "matched_need_tags": [],
            }

    # --- 最後に1回だけ：表示名と reason / bullets を全件確定 ---
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

    return recs
