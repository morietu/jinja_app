import json

import pytest


# 1) area → geocode → findplace の locationbias を検証（あなたのテストをそのまま利用）
@pytest.mark.django_db
def test_chat_backfills_short_location(client, settings, monkeypatch):
    settings.GOOGLE_MAPS_API_KEY = "dummy"

    class _R:
        def __init__(self, payload):
            self._p = payload

        def json(self):
            return self._p

        def raise_for_status(self):
            return None

    last_findplace_params = {}

    def fake_get(url, params=None, timeout=None, **kw):
        nonlocal last_findplace_params
        params = params or {}
        if "geocode" in url:
            # "港区赤坂" を座標化
            return _R({"results": [{"geometry": {"location": {"lat": 35.671, "lng": 139.736}}}]})
        if "findplacefromtext" in url:
            last_findplace_params = dict(params)  # locationbias 検証用
            return _R({"candidates": [{"place_id": "PID_AKASAKA"}]})
        if "place/details" in url:
            return _R(
                {"result": {"formatted_address": "日本、〒107-0052 東京都港区赤坂6丁目10−12"}}
            )
        return _R({})

    monkeypatch.setattr("temples.llm.backfill.requests.get", fake_get)
    monkeypatch.setattr("temples.api_views_concierge.requests.get", fake_get)

    res = client.post(
        "/api/concierge/chat/",
        data=json.dumps(
            {
                "query": "縁結び 徒歩",
                "area": "港区赤坂",
                "candidates": [{"name": "赤坂氷川神社"}],
            }
        ),
        content_type="application/json",
    )
    assert res.status_code == 200
    rec = res.json()["data"]["recommendations"][0]
    assert rec["name"] == "赤坂氷川神社"
    assert rec["location"] == "港区赤坂"  # 住所短縮が効いている

    # area から得た座標で locationbias（半径 8000m）が付与されていること（_enrich の既定値）
    assert last_findplace_params.get("locationbias") == "circle:8000@35.671,139.736"


# 2) radius_km の伝播は内部関数への bias で検証（URL文字列に依存しない形に変更）
@pytest.mark.django_db
def test_radius_km_bias_passthrough(client, settings, monkeypatch):
    settings.GOOGLE_MAPS_API_KEY = "dummy"

    # Orchestrator の LLM 結果を固定
    from temples.llm.orchestrator import ConciergeOrchestrator

    monkeypatch.setattr(
        ConciergeOrchestrator,
        "suggest",
        lambda self, query, candidates: {
            "recommendations": [{"name": "赤坂氷川神社", "reason": "x"}]
        },
    )

    # _lookup_address_by_name に渡る bias を捕捉
    import temples.llm.backfill as bf

    seen = {}

    def fake_lookup(name, bias=None, lang="ja"):
        seen["bias"] = bias
        return "東京都港区赤坂6丁目10−12"

    monkeypatch.setattr(bf, "_lookup_address_by_name", fake_lookup)

    res = client.post(
        "/api/concierge/chat/",
        data=json.dumps(
            {
                "query": "縁結び 徒歩",
                "lat": 35.6812,
                "lng": 139.7671,
                "radius_km": 5,  # 5km → 5000m
                "candidates": [{"name": "赤坂氷川神社"}],
            }
        ),
        content_type="application/json",
    )
    assert res.status_code == 200
    assert seen["bias"]["lat"] == 35.6812
    assert seen["bias"]["lng"] == 139.7671
    assert seen["bias"]["radius"] == 5000  # 変換結果を直接検証


# 3) candidates[].formatted_address があればそれを優先し、短縮表示される
@pytest.mark.django_db
def test_candidate_formatted_address_is_used(client, settings, monkeypatch):
    settings.GOOGLE_MAPS_API_KEY = "dummy"

    from temples.llm.orchestrator import ConciergeOrchestrator

    monkeypatch.setattr(
        ConciergeOrchestrator,
        "suggest",
        lambda self, query, candidates: {
            "recommendations": [{"name": "赤坂氷川神社", "reason": "x"}]
        },
    )

    res = client.post(
        "/api/concierge/chat/",
        data=json.dumps(
            {
                "query": "縁結び 徒歩",
                "candidates": [
                    {
                        "name": "赤坂氷川神社",
                        "formatted_address": "日本、〒107-0052 東京都港区赤坂6丁目10−12",
                    }
                ],
            }
        ),
        content_type="application/json",
    )
    assert res.status_code == 200
    rec = res.json()["data"]["recommendations"][0]
    assert rec["location"] == "港区赤坂"
