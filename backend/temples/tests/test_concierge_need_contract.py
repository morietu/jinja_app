# backend/temples/tests/test_concierge_need_contract.py
import pytest

from temples.models import Shrine
from temples.services.concierge_chat import build_chat_recommendations


# -----------------------------
# Core scoring contract
# -----------------------------
@pytest.mark.django_db
def test_concierge_need_contract_need_and_breakdown(monkeypatch, settings):
    """
    Contract:
      - build_chat_recommendations は data._need を返す
        - _need.tags: 最大3件、優先度順
        - _need.hits: どの語で当たったか（デバッグ用）
      - recommendations[i].breakdown を返す
        - score_element: 0/1/2
        - score_need: matched_need_tags の件数（最小構成）
        - score_popular: popular_score を 0..1 に正規化（popular/10 を clamp）
        - score_total: score_element*W1 + score_need*W2 + score_popular*W3
        - weights: {element, need, popular}
        - matched_need_tags: need_tags ∩ shrine_astro_tags
    """
    settings.CONCIERGE_USE_LLM = True
    monkeypatch.setenv("CHAT_MAX_ADDRESS_LOOKUPS", "0")

    query = "最近疲れが取れない。転職も不安。"

    import temples.domain.need_tags as need

    class FakeNeedExtract:
        def __init__(self):
            self.tags = ["career", "mental", "rest"]
            self.hits = {"career": ["転職"], "mental": ["不安"], "rest": ["疲れ"]}

    monkeypatch.setattr(
        need,
        "extract_need_tags",
        lambda q, max_tags=3: FakeNeedExtract(),
        raising=True,
    )

    import temples.domain.astrology as astro

    class _Prof:
        sign = "牡牛座"
        element = "土"

    monkeypatch.setattr(
        astro,
        "sun_sign_and_element",
        lambda birthdate: _Prof(),
        raising=True,
    )

    def fake_element_priority(user_elem, shrine_elems):
        shrine_elems = shrine_elems or []
        s = {str(x).strip() for x in shrine_elems if str(x).strip()}
        if "土" in s:
            return 2
        if "水" in s:
            return 1
        return 0

    monkeypatch.setattr(astro, "element_priority", fake_element_priority, raising=True)

    import temples.llm.orchestrator as orch

    class DummyOrchestrator:
        def suggest(self, *, query, candidates):
            return {
                "recommendations": [
                    {
                        "name": "A",
                        "reason": "",
                        "popular_score": 8.0,
                        "astro_elements": ["土"],
                        "astro_tags": ["career", "rest"],
                    },
                    {
                        "name": "B",
                        "reason": "",
                        "popular_score": 3.0,
                        "astro_elements": ["水"],
                        "astro_tags": ["mental"],
                    },
                    {
                        "name": "C",
                        "reason": "",
                        "popular_score": 0.0,
                        "astro_elements": ["火"],
                        "astro_tags": [],
                    },
                ]
            }

    monkeypatch.setattr(orch, "ConciergeOrchestrator", DummyOrchestrator, raising=True)

    recs = build_chat_recommendations(
        query=query,
        language="ja",
        candidates=[{"name": "A"}, {"name": "B"}, {"name": "C"}],
        bias=None,
        birthdate="1984-05-15",
    )

    assert isinstance(recs, dict)
    assert "_need" in recs
    assert recs["_need"]["tags"] == ["career", "mental", "rest"]
    assert recs["_need"]["hits"]["career"] == ["転職"]
    assert recs["_need"]["hits"]["mental"] == ["不安"]
    assert recs["_need"]["hits"]["rest"] == ["疲れ"]

    items = recs["recommendations"]
    assert len(items) == 3

    a = items[0]
    assert a["name"] == "A"
    bd = a["breakdown"]
    assert bd["weights"] == {"element": 0.6, "need": 0.3, "popular": 0.1}
    assert bd["score_element"] == 2
    assert bd["matched_need_tags"] == ["career", "rest"]
    assert bd["score_need"] == 2
    assert bd["score_popular"] == 0.8

    expected_total = 2 * 0.6 + 2 * 0.3 + 0.8 * 0.1
    assert bd["score_total"] == pytest.approx(expected_total, rel=1e-6)

    b = items[1]["breakdown"]
    assert b["score_element"] == 1
    assert b["matched_need_tags"] == ["mental"]
    assert b["score_need"] == 1
    assert b["score_popular"] == 0.3

    c = items[2]["breakdown"]
    assert c["score_element"] == 0
    assert c["matched_need_tags"] == []
    assert c["score_need"] == 0
    assert c["score_popular"] == 0.0


# -----------------------------
# Astrology contract
# -----------------------------
@pytest.mark.django_db
def test_chat_astrology_uses_db_astro_elements_and_picks_top3(monkeypatch, settings):
    """
    NOTE:
      - このテストは LLM enabled 前提（settings.CONCIERGE_USE_LLM=True）。
      - candidates=[] のため、LLM無効だと orchestrator が呼ばれず recommendations が空になりうる。
      - 目的は「recommendations に astro_elements が無くても DB から attach され、top3 が pick される」ことの検証。
    """
    settings.CONCIERGE_USE_LLM = True
    monkeypatch.setenv("CHAT_MAX_ADDRESS_LOOKUPS", "0")

    Shrine.objects.create(name_jp="A", astro_elements=["fire"])
    Shrine.objects.create(name_jp="B", astro_elements=["water"])
    Shrine.objects.create(name_jp="C", astro_elements=["fire"])
    Shrine.objects.create(name_jp="D", astro_elements=[])
    Shrine.objects.create(name_jp="E", astro_elements=["fire"])

    import temples.llm.orchestrator as orch

    class DummyOrchestrator:
        def suggest(self, *, query, candidates):
            return {
                "recommendations": [
                    {"name": "A", "reason": ""},
                    {"name": "B", "reason": ""},
                    {"name": "C", "reason": ""},
                    {"name": "D", "reason": ""},
                    {"name": "E", "reason": ""},
                ]
            }

    monkeypatch.setattr(orch, "ConciergeOrchestrator", DummyOrchestrator, raising=True)

    import temples.domain.astrology as astro

    def fake_element_priority(user_element, rec_elements):
        rec_elements = rec_elements or []
        if "fire" in rec_elements:
            return 2
        if "water" in rec_elements:
            return 1
        return 0

    monkeypatch.setattr(astro, "element_priority", fake_element_priority, raising=True)

    recs = build_chat_recommendations(
        query="近場で縁結び",
        language="ja",
        candidates=[],
        bias=None,
        birthdate="2000-03-21",
    )

    assert len(recs["recommendations"]) == 3


# -----------------------------
# Reason / UI contract
# -----------------------------
@pytest.mark.django_db
def test_concierge_reason_source_contract(monkeypatch, settings):
    """
    Contract:
      - matched_need_tags がある推薦は reason_source == "reason:matched_need_tags"
      - normalize/fallback 経由の推薦も reason_source は "reason:" prefix を持つ
      - 元の reason は UI 用にそのまま採用されない
    """
    settings.CONCIERGE_USE_LLM = True
    monkeypatch.setenv("CHAT_MAX_ADDRESS_LOOKUPS", "0")

    import temples.domain.need_tags as need

    class FakeNeedExtract:
        def __init__(self):
            self.tags = ["career"]
            self.hits = {"career": ["転職"]}

    monkeypatch.setattr(
        need,
        "extract_need_tags",
        lambda q, max_tags=3: FakeNeedExtract(),
        raising=True,
    )

    import temples.domain.astrology as astro

    class _Prof:
        sign = "牡牛座"
        element = "土"

    monkeypatch.setattr(
        astro,
        "sun_sign_and_element",
        lambda birthdate: _Prof(),
        raising=True,
    )
    monkeypatch.setattr(
        astro,
        "element_priority",
        lambda user_elem, shrine_elems: 0,
        raising=True,
    )

    import temples.llm.orchestrator as orch

    class DummyOrchestrator:
        def suggest(self, *, query, candidates):
            return {
                "recommendations": [
                    {
                        "name": "A",
                        "reason": "古い理由文",
                        "popular_score": 8.0,
                        "astro_elements": ["火"],
                        "astro_tags": ["career"],
                    },
                    {
                        "name": "B",
                        "reason": "観音",
                        "popular_score": 3.0,
                        "astro_elements": ["水"],
                        "astro_tags": [],
                        "deities": ["観音"],
                    },
                    {
                        "name": "C",
                        "reason": "",
                        "popular_score": 0.0,
                        "astro_elements": ["火"],
                        "astro_tags": [],
                    },
                ]
            }

    monkeypatch.setattr(orch, "ConciergeOrchestrator", DummyOrchestrator, raising=True)

    recs = build_chat_recommendations(
        query="転職が不安",
        language="ja",
        candidates=[{"name": "A"}, {"name": "B"}, {"name": "C"}],
        bias=None,
        birthdate="1984-05-15",
    )

    by_name = {x["name"]: x for x in recs["recommendations"]}

    assert by_name["A"]["breakdown"]["matched_need_tags"] == ["career"]
    assert by_name["A"]["reason_source"] == "reason:matched_need_tags"

    assert by_name["B"]["reason_source"].startswith("reason:")
    assert by_name["C"]["reason_source"].startswith("reason:")

    assert by_name["A"]["reason"] != "古い理由文"
    assert by_name["B"]["reason"] != "観音"

    assert by_name["B"]["reason_source"] != "raw"
    assert by_name["C"]["reason_source"] != "fallback_static"


# -----------------------------
# Fallback / result_state contract
# -----------------------------
@pytest.mark.django_db
def test_concierge_fallback_result_state_when_filters_zero(monkeypatch, settings):
    """
    Contract:
      - user filter で 0件になった場合、_signals.result_state に
        fallback 情報が入る
      - fallback_mode == "nearby_unfiltered"
      - matched_count == 0
      - recommendations 自体は近隣候補で 3件に戻る
    """
    settings.CONCIERGE_USE_LLM = False
    monkeypatch.setenv("CHAT_MAX_ADDRESS_LOOKUPS", "0")

    recs = build_chat_recommendations(
        query="近場でお参りしたい",
        language="ja",
        candidates=[
            {
                "name": "A",
                "lat": 35.0,
                "lng": 139.0,
                "distance_m": 100.0,
                "goriyaku_tag_ids": [1],
                "popular_score": 8.0,
            },
            {
                "name": "B",
                "lat": 35.001,
                "lng": 139.001,
                "distance_m": 200.0,
                "goriyaku_tag_ids": [2],
                "popular_score": 5.0,
            },
            {
                "name": "C",
                "lat": 35.002,
                "lng": 139.002,
                "distance_m": 300.0,
                "goriyaku_tag_ids": [3],
                "popular_score": 3.0,
            },
        ],
        bias={"lat": 35.0, "lng": 139.0, "radius": 8000.0, "radius_m": 8000.0},
        birthdate=None,
        goriyaku_tag_ids=[999],
    )

    assert isinstance(recs, dict)
    assert "_signals" in recs
    assert isinstance(recs["_signals"], dict)

    rs = recs["_signals"]["result_state"]
    assert rs["matched_count"] == 0
    assert rs["fallback_mode"] == "nearby_unfiltered"
    assert rs["fallback_reason_ja"] == "条件に一致する神社が見つかりませんでした（0件）"
    assert rs["ui_disclaimer_ja"] == "代わりに近い神社を表示しています（条件は反映されていません）"
    assert rs["requested_extra_condition"] is None
    assert rs["displayed_count"] == len(recs["recommendations"])

    assert len(recs["recommendations"]) == 3
    assert [x["name"] for x in recs["recommendations"]] == ["A", "B", "C"]


@pytest.mark.django_db
def test_concierge_fallback_sorts_by_distance_when_filters_zero(monkeypatch, settings):
    """
    Contract:
      - goriyaku_tag_ids により一致0件になった場合、
        result_state.fallback_mode == "nearby_unfiltered" になる
      - recommendations は distance_m 昇順で返る
    """
    settings.CONCIERGE_USE_LLM = False
    monkeypatch.setenv("CHAT_MAX_ADDRESS_LOOKUPS", "0")

    recs = build_chat_recommendations(
        query="近場で参拝したい",
        language="ja",
        birthdate=None,
        bias=None,
        goriyaku_tag_ids=[999],
        candidates=[
            {
                "name": "C",
                "distance_m": 300.0,
                "lat": 35.003,
                "lng": 139.003,
                "goriyaku_tag_ids": [1],
            },
            {
                "name": "A",
                "distance_m": 100.0,
                "lat": 35.001,
                "lng": 139.001,
                "goriyaku_tag_ids": [2],
            },
            {
                "name": "B",
                "distance_m": 200.0,
                "lat": 35.002,
                "lng": 139.002,
                "goriyaku_tag_ids": [3],
            },
        ],
    )

    assert isinstance(recs, dict)

    rs = recs["_signals"]["result_state"]
    assert rs["matched_count"] == 0
    assert rs["fallback_mode"] == "nearby_unfiltered"

    items = recs["recommendations"]
    assert [x["name"] for x in items] == ["A", "B", "C"]
    assert [x["distance_m"] for x in items] == [100.0, 200.0, 300.0]


@pytest.mark.django_db
def test_concierge_result_state_displayed_count_in_normal_flow(monkeypatch, settings):
    """
    Contract:
      - 通常系（fallback ではない）でも _signals.result_state.displayed_count が入る
      - displayed_count は実際の recommendations 件数と一致する
      - fallback_mode == "none"
    """
    settings.CONCIERGE_USE_LLM = False
    monkeypatch.setenv("CHAT_MAX_ADDRESS_LOOKUPS", "0")

    recs = build_chat_recommendations(
        query="近場で参拝したい",
        language="ja",
        birthdate=None,
        bias=None,
        candidates=[
            {
                "name": "A",
                "distance_m": 300.0,
                "lat": 35.003,
                "lng": 139.003,
                "popular_score": 9.0,
                "goriyaku_tag_ids": [1],
            },
            {
                "name": "B",
                "distance_m": 200.0,
                "lat": 35.002,
                "lng": 139.002,
                "popular_score": 5.0,
                "goriyaku_tag_ids": [2],
            },
            {
                "name": "C",
                "distance_m": 100.0,
                "lat": 35.001,
                "lng": 139.001,
                "popular_score": 1.0,
                "goriyaku_tag_ids": [3],
            },
        ],
    )

    assert isinstance(recs, dict)
    assert "_signals" in recs
    assert isinstance(recs["_signals"], dict)

    rs = recs["_signals"]["result_state"]
    assert rs["fallback_mode"] == "none"
    assert rs["matched_count"] == 3
    assert rs["displayed_count"] == len(recs["recommendations"])
    assert len(recs["recommendations"]) == 3


@pytest.mark.django_db
def test_concierge_result_state_pool_count_contract(monkeypatch, settings):
    """
    Contract:
      - result_state.pool_count は、最終的な推薦プール件数を表す
      - 通常系では recommendations 件数と一致する
      - fallback 系でも recommendations 件数と一致する
    """
    settings.CONCIERGE_USE_LLM = False
    monkeypatch.setenv("CHAT_MAX_ADDRESS_LOOKUPS", "0")

    recs_normal = build_chat_recommendations(
        query="近場で参拝したい",
        language="ja",
        birthdate=None,
        bias=None,
        candidates=[
            {
                "name": "A",
                "distance_m": 100.0,
                "lat": 35.001,
                "lng": 139.001,
                "popular_score": 9.0,
                "goriyaku_tag_ids": [1],
            },
            {
                "name": "B",
                "distance_m": 200.0,
                "lat": 35.002,
                "lng": 139.002,
                "popular_score": 5.0,
                "goriyaku_tag_ids": [2],
            },
            {
                "name": "C",
                "distance_m": 300.0,
                "lat": 35.003,
                "lng": 139.003,
                "popular_score": 1.0,
                "goriyaku_tag_ids": [3],
            },
        ],
    )

    rs_normal = recs_normal["_signals"]["result_state"]
    assert rs_normal["fallback_mode"] == "none"
    assert rs_normal["pool_count"] == len(recs_normal["recommendations"])

    recs_fallback = build_chat_recommendations(
        query="近場で参拝したい",
        language="ja",
        birthdate=None,
        bias=None,
        goriyaku_tag_ids=[999],
        candidates=[
            {
                "name": "A",
                "distance_m": 100.0,
                "lat": 35.001,
                "lng": 139.001,
                "popular_score": 9.0,
                "goriyaku_tag_ids": [1],
            },
            {
                "name": "B",
                "distance_m": 200.0,
                "lat": 35.002,
                "lng": 139.002,
                "popular_score": 5.0,
                "goriyaku_tag_ids": [2],
            },
            {
                "name": "C",
                "distance_m": 300.0,
                "lat": 35.003,
                "lng": 139.003,
                "popular_score": 1.0,
                "goriyaku_tag_ids": [3],
            },
        ],
    )

    rs_fallback = recs_fallback["_signals"]["result_state"]
    assert rs_fallback["fallback_mode"] == "nearby_unfiltered"
    assert rs_fallback["pool_count"] == len(recs_fallback["recommendations"])
    assert rs_fallback["displayed_count"] == len(recs_fallback["recommendations"])


@pytest.mark.django_db
def test_concierge_result_state_keeps_requested_extra_condition(monkeypatch, settings):
    settings.CONCIERGE_USE_LLM = False
    monkeypatch.setenv("CHAT_MAX_ADDRESS_LOOKUPS", "0")

    recs = build_chat_recommendations(
        query="静かに参拝したい",
        language="ja",
        birthdate=None,
        bias=None,
        extra_condition="落ち着きたい",
        candidates=[
            {"name": "A", "distance_m": 100.0, "lat": 35.001, "lng": 139.001, "popular_score": 9.0},
            {"name": "B", "distance_m": 200.0, "lat": 35.002, "lng": 139.002, "popular_score": 5.0},
            {"name": "C", "distance_m": 300.0, "lat": 35.003, "lng": 139.003, "popular_score": 1.0},
        ],
    )

    rs = recs["_signals"]["result_state"]
    assert rs["fallback_mode"] == "none"
    assert rs["requested_extra_condition"] == "落ち着きたい"


# -----------------------------
# Sort / signal contract
# -----------------------------
@pytest.mark.django_db
def test_concierge_sort_distance_override_sorts_by_distance(monkeypatch, settings):
    """
    Contract:
      - extra_condition から sort_distance が抽出された場合、
        fallback でなくても recommendations は distance_m 昇順で返る
    """
    settings.CONCIERGE_USE_LLM = False
    monkeypatch.setenv("CHAT_MAX_ADDRESS_LOOKUPS", "0")

    import temples.services.concierge_chat as chat

    class FakeExtraExtract:
        def __init__(self):
            self.tags = ["sort_distance"]
            self.hits = {"sort_distance": ["近い順"]}

    monkeypatch.setattr(
        chat,
        "extract_extra_tags",
        lambda text, max_tags=3: FakeExtraExtract(),
        raising=True,
    )
    monkeypatch.setattr(
        chat,
        "split_tags_by_kind",
        lambda tags: {
            "sort_override": ["sort_distance"],
            "hard_filter": [],
            "soft_signal": [],
            "unknown": [],
        },
        raising=True,
    )

    recs = build_chat_recommendations(
        query="雰囲気重視で探したい",
        language="ja",
        birthdate=None,
        bias=None,
        extra_condition="近い順で",
        candidates=[
            {
                "name": "B",
                "distance_m": 200.0,
                "lat": 35.002,
                "lng": 139.002,
                "popular_score": 9.0,
            },
            {
                "name": "C",
                "distance_m": 300.0,
                "lat": 35.003,
                "lng": 139.003,
                "popular_score": 10.0,
            },
            {
                "name": "A",
                "distance_m": 100.0,
                "lat": 35.001,
                "lng": 139.001,
                "popular_score": 1.0,
            },
        ],
    )

    assert isinstance(recs, dict)

    rs = recs["_signals"]["result_state"]
    assert rs["fallback_mode"] == "none"
    assert rs["matched_count"] == 3

    items = recs["recommendations"]
    assert [x["name"] for x in items] == ["A", "B", "C"]
    assert [x["distance_m"] for x in items] == [100.0, 200.0, 300.0]


@pytest.mark.django_db
def test_concierge_soft_signal_affects_highlights_not_score(monkeypatch, settings):
    """
    Contract:
      - extra_condition から soft_signal が抽出された場合、
        highlights には反映される
      - ただし score_total や recommendations の並び順は変わらない
    """
    settings.CONCIERGE_USE_LLM = False
    monkeypatch.setenv("CHAT_MAX_ADDRESS_LOOKUPS", "0")

    import temples.services.concierge_chat as chat

    class FakeExtraExtract:
        def __init__(self):
            self.tags = ["calm"]
            self.hits = {"calm": ["落ち着きたい"]}

    monkeypatch.setattr(
        chat,
        "extract_extra_tags",
        lambda text, max_tags=3: FakeExtraExtract(),
        raising=True,
    )
    monkeypatch.setattr(
        chat,
        "split_tags_by_kind",
        lambda tags: {
            "sort_override": [],
            "hard_filter": [],
            "soft_signal": ["calm"],
            "unknown": [],
        },
        raising=True,
    )

    recs = build_chat_recommendations(
        query="静かに参拝したい",
        language="ja",
        birthdate=None,
        bias=None,
        extra_condition="落ち着きたい",
        candidates=[
            {
                "name": "A",
                "distance_m": 300.0,
                "lat": 35.003,
                "lng": 139.003,
                "popular_score": 9.0,
            },
            {
                "name": "B",
                "distance_m": 200.0,
                "lat": 35.002,
                "lng": 139.002,
                "popular_score": 5.0,
            },
            {
                "name": "C",
                "distance_m": 100.0,
                "lat": 35.001,
                "lng": 139.001,
                "popular_score": 1.0,
            },
        ],
    )

    items = recs["recommendations"]
    assert [x["name"] for x in items] == ["A", "B", "C"]

    for item in items:
        assert "breakdown" in item
        assert isinstance(item["breakdown"]["score_total"], float)

        hs = item.get("highlights") or []
        assert isinstance(hs, list)
        assert "落ち着いて気持ちを整えやすい雰囲気" in hs


# -----------------------------
# Message contract
# -----------------------------
@pytest.mark.django_db
def test_concierge_message_contract_normal_and_empty(monkeypatch, settings):
    settings.CONCIERGE_USE_LLM = True
    monkeypatch.setenv("CHAT_MAX_ADDRESS_LOOKUPS", "0")

    import temples.llm.orchestrator as orch

    class DummyOrchestratorNormal:
        def suggest(self, *, query, candidates):
            return {
                "recommendations": [
                    {"name": "A", "reason": "", "popular_score": 8.0},
                    {"name": "B", "reason": "", "popular_score": 3.0},
                    {"name": "C", "reason": "", "popular_score": 1.0},
                ]
            }

    monkeypatch.setattr(orch, "ConciergeOrchestrator", DummyOrchestratorNormal, raising=True)

    recs = build_chat_recommendations(
        query="近場で縁結び",
        language="ja",
        candidates=[{"name": "A"}, {"name": "B"}, {"name": "C"}],
        bias=None,
        birthdate=None,
    )

    assert isinstance(recs.get("message"), str)
    assert recs["message"]
    assert "相談内容と近さをもとに、参拝候補を3件に整理しました。" in recs["message"]

    class DummyOrchestratorEmpty:
        def suggest(self, *, query, candidates):
            return {"recommendations": []}

    monkeypatch.setattr(orch, "ConciergeOrchestrator", DummyOrchestratorEmpty, raising=True)

    recs = build_chat_recommendations(
        query="近場で縁結び",
        language="ja",
        candidates=[],
        bias=None,
        birthdate=None,
    )

    assert isinstance(recs.get("message"), str)
    assert recs["message"]
    assert "条件に合いそうな神社が見つかりませんでした。" in recs["message"]


@pytest.mark.django_db
def test_concierge_message_includes_top_names_contract(monkeypatch, settings):
    """
    Contract:
      - message が未設定のとき、自動生成される
      - recommendations がある場合、message に top3 の候補名が含まれる
    """
    settings.CONCIERGE_USE_LLM = True
    monkeypatch.setenv("CHAT_MAX_ADDRESS_LOOKUPS", "0")

    import temples.llm.orchestrator as orch

    class DummyOrchestrator:
        def suggest(self, *, query, candidates):
            return {
                "recommendations": [
                    {"name": "A", "reason": "", "popular_score": 8.0},
                    {"name": "B", "reason": "", "popular_score": 3.0},
                    {"name": "C", "reason": "", "popular_score": 1.0},
                ]
            }

    monkeypatch.setattr(orch, "ConciergeOrchestrator", DummyOrchestrator, raising=True)

    recs = build_chat_recommendations(
        query="近場で縁結び",
        language="ja",
        candidates=[{"name": "A"}, {"name": "B"}, {"name": "C"}],
        bias=None,
        birthdate=None,
    )

    assert isinstance(recs.get("message"), str)
    assert recs["message"]
    assert "相談内容と近さをもとに、参拝候補を3件に整理しました。" in recs["message"]
    assert "A" in recs["message"]
    assert "B" in recs["message"]
    assert "C" in recs["message"]


@pytest.mark.django_db
def test_concierge_explanation_contract(monkeypatch, settings):
    settings.CONCIERGE_USE_LLM = True
    monkeypatch.setenv("CHAT_MAX_ADDRESS_LOOKUPS", "0")

    import temples.domain.need_tags as need
    class FakeNeedExtract:
        def __init__(self):
            self.tags = ["mental"]
            self.hits = {"mental": ["不安"]}

    monkeypatch.setattr(
        need,
        "extract_need_tags",
        lambda q, max_tags=3: FakeNeedExtract(),
        raising=True,
    )

    import temples.llm.orchestrator as orch
    class DummyOrchestrator:
        def suggest(self, *, query, candidates):
            return {
                "recommendations": [
                    {
                        "name": "A",
                        "reason": "",
                        "popular_score": 8.0,
                        "astro_tags": ["mental"],
                        "highlights": ["落ち着いて気持ちを整えやすい雰囲気"],
                        "distance_m": 420.0,
                    }
                ]
            }

    monkeypatch.setattr(orch, "ConciergeOrchestrator", DummyOrchestrator, raising=True)

    recs = build_chat_recommendations(
        query="最近不安が強い",
        language="ja",
        candidates=[{"name": "A"}],
        bias=None,
        birthdate=None,
    )

    item = recs["recommendations"][0]
    assert item["reason"] == "不安・心に向き合う参拝に"
    assert isinstance(item["bullets"], list)
    assert item["bullets"][0] == "落ち着いて気持ちを整えやすい雰囲気"
    assert item["reason_source"] == "reason:matched_need_tags"

    exp = item["explanation"]
    assert isinstance(exp, dict)
    assert exp["summary"] == item["reason"]
    assert isinstance(exp["reasons"], list)
    assert len(exp["reasons"]) >= 1



    assert any(r["code"] == "NEED_MATCH" for r in exp["reasons"])
    assert any(r["code"] == "SHRINE_FEATURE" for r in exp["reasons"])
    assert any(r["code"] == "DISTANCE" for r in exp["reasons"])
    assert not any(r["code"] == "REASON_SOURCE" for r in exp["reasons"])
    assert not any(r["code"] == "SCORE" for r in exp["reasons"])
