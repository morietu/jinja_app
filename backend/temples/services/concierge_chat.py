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
    recs["_astro"] = {"sun_sign": prof.sign, "element": prof.element}
    return recs


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

    # 空なら fallback 1件（IndexError 回避）
    if not recs["recommendations"]:
        if candidates and isinstance(candidates[0], dict) and candidates[0].get("name"):
            recs["recommendations"] = [{"name": candidates[0]["name"], "reason": ""}]
        else:
            recs["recommendations"] = [{"name": "近隣の神社", "reason": ""}]

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

    # ✅ chatは3件固定
    try:
        recs["recommendations"] = (recs.get("recommendations") or [])[:3]
    except Exception:
        pass

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
