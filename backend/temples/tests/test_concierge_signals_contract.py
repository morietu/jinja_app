# backend/temples/tests/test_concierge_signals_contract.py
import pytest

from temples.services.concierge_chat import build_chat_recommendations


@pytest.mark.django_db
def test_concierge_engine_and_llm_signals_contract(monkeypatch, settings):
    """
    Contract:
      - _signals.llm が常に入る
        - enabled / used / error を持つ
      - _signals.engine が常に入る
        - orchestrator_used / openai_enabled / openai_used を持つ
      - LLM無効時は、enabled=False / used=False / openai_used=False
    """
    settings.CONCIERGE_USE_LLM = False
    monkeypatch.setenv("CHAT_MAX_ADDRESS_LOOKUPS", "0")

    recs = build_chat_recommendations(
        query="近場で参拝したい",
        language="ja",
        candidates=[
            {
                "name": "A",
                "distance_m": 100.0,
                "lat": 35.001,
                "lng": 139.001,
                "popular_score": 8.0,
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
                "distance_m": 300.0,
                "lat": 35.003,
                "lng": 139.003,
                "popular_score": 3.0,
            },
        ],
        bias=None,
        birthdate=None,
    )

    assert isinstance(recs, dict)
    assert "_signals" in recs
    assert isinstance(recs["_signals"], dict)

    llm = recs["_signals"]["llm"]
    engine = recs["_signals"]["engine"]

    assert set(llm.keys()) == {"enabled", "used", "error"}
    assert isinstance(llm["enabled"], bool)
    assert isinstance(llm["used"], bool)
    assert llm["enabled"] is False
    assert llm["used"] is False
    assert llm["error"] is None

    assert set(engine.keys()) == {
        "orchestrator_used",
        "openai_enabled",
        "openai_used",
    }
    assert isinstance(engine["orchestrator_used"], bool)
    assert isinstance(engine["openai_enabled"], bool)
    assert isinstance(engine["openai_used"], bool)

    assert engine["orchestrator_used"] is False
    assert engine["openai_enabled"] is False
    assert engine["openai_used"] is False


@pytest.mark.django_db
def test_concierge_stats_contract_counts_and_missing_fields(monkeypatch, settings):
    """
    Contract:
      - _signals.stats が常に入る
      - candidate_count / valid_candidate_count / pool_count / displayed_count を持つ
      - missing_fields.place_id / latlng / address が dict(missing, rate) で入る
    """
    settings.CONCIERGE_USE_LLM = False
    monkeypatch.setenv("CHAT_MAX_ADDRESS_LOOKUPS", "0")

    recs = build_chat_recommendations(
        query="近場で参拝したい",
        language="ja",
        candidates=[
            {
                "name": "A",
                "distance_m": 100.0,
                "lat": 35.001,
                "lng": 139.001,
                "popular_score": 8.0,
                # place_id なし / address なし
            },
            {
                "name": "B",
                "distance_m": 200.0,
                "lat": 35.002,
                "lng": 139.002,
                "popular_score": 5.0,
                "place_id": "place_b",
                # address なし
            },
            {
                "name": "C",
                "distance_m": 300.0,
                "popular_score": 3.0,
                "formatted_address": "東京都千代田区",
                # lat/lng なし
            },
        ],
        bias=None,
        birthdate=None,
    )

    assert isinstance(recs, dict)
    assert "_signals" in recs
    assert isinstance(recs["_signals"], dict)

    stats = recs["_signals"]["stats"]
    assert isinstance(stats, dict)

    assert isinstance(stats["candidate_count"], int)
    assert isinstance(stats["valid_candidate_count"], int)
    assert isinstance(stats["pool_count"], int)
    assert isinstance(stats["displayed_count"], int)

    assert stats["candidate_count"] == 3
    assert stats["valid_candidate_count"] == 3
    assert stats["pool_count"] == len(recs["recommendations"])
    assert stats["displayed_count"] == len(recs["recommendations"])

    mf = stats["missing_fields"]
    assert isinstance(mf, dict)
    assert mf["total"] == 3

    for key in ("place_id", "latlng", "address"):
        assert key in mf
        assert isinstance(mf[key], dict)
        assert set(mf[key].keys()) == {"missing", "rate"}
        assert isinstance(mf[key]["missing"], int)
        assert isinstance(mf[key]["rate"], float)

    # 入力に基づく最小限の契約確認
    assert mf["place_id"]["missing"] == 2
    assert mf["latlng"]["missing"] == 1
    assert mf["address"]["missing"] == 2
