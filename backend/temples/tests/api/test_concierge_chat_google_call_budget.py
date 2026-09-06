# backend/temples/tests/api/test_concierge_chat_google_call_budget.py
"""
Concierge chat 本番経路が出す Google 呼び出し回数の回帰テスト。

テスト専用だった _probe_area_locationbias_for_chat() を除去したため、
area が来ても probe 由来の Geocoding / Find Place は発生しない。

期待するGoogle呼び出し:
- top-level lat/lng あり            → Geocoding 0回
- location:{lat,lng} あり           → Geocoding 0回
- area のみ                         → Geocoding 最大1回（location解決のみ）
- quota blocked                     → Geocoding / Find Place 0回

probe 由来の Find Place だけを隔離する方法:

旧 probe は Places.findplacefromtext(input=area, fields="place_id",
locationbias="circle:8000@...") を呼ぶ唯一の経路だった。
一方 chat 経路の正当な address backfill は
concierge_chat_presentation._backfill_location_from_name() →
backfill._lookup_address_by_name(name=...) であり、input には
recommendation 名が入る（request candidate の住所有無ではなく、
生成された recommendation の location/address 有無で発火する）。

したがって input が area 文字列である Find Place を「probe 由来」として
数えれば、正当な address backfill と混同せずに隔離できる。
address backfill 自体の契約は本タスクの対象外なので触っていない。
"""
import json
from types import SimpleNamespace

import pytest
import requests


URL = "/api/concierge/chat/"

AREA = "港区赤坂"

CANDIDATE_WITH_ADDRESS = {
    "name": "赤坂氷川神社",
    "formatted_address": "日本、〒107-0052 東京都港区赤坂6丁目10−12",
}


class _R:
    def __init__(self, payload):
        self._p = payload

    def json(self):
        return self._p

    def raise_for_status(self):
        return None


@pytest.fixture
def google_calls(monkeypatch, settings):
    """requests.get をグローバルに差し替えて Google 呼び出しを数える。"""
    settings.GOOGLE_MAPS_API_KEY = "dummy"

    from temples.llm.orchestrator import ConciergeOrchestrator

    monkeypatch.setattr(
        ConciergeOrchestrator,
        "suggest",
        lambda self, query, candidates: {
            "recommendations": [{"name": "赤坂氷川神社", "reason": "x"}]
        },
    )

    calls = {"geocode": 0, "findplacefromtext": 0, "findplace_inputs": [], "details": 0}

    def fake_get(url, params=None, timeout=None, **kw):
        params = params or {}
        if "geocode" in url:
            calls["geocode"] += 1
            return _R(
                {"results": [{"geometry": {"location": {"lat": 35.671, "lng": 139.736}}}]}
            )
        if "findplacefromtext" in url:
            calls["findplacefromtext"] += 1
            calls["findplace_inputs"].append(params.get("input"))
            return _R({"candidates": [{"place_id": "PID_AKASAKA"}]})
        if "place/details" in url:
            calls["details"] += 1
            return _R(
                {"result": {"formatted_address": "日本、〒107-0052 東京都港区赤坂6丁目10−12"}}
            )
        return _R({})

    monkeypatch.setattr(requests, "get", fake_get)
    return calls


def _post(client, payload):
    return client.post(URL, data=json.dumps(payload), content_type="application/json")


@pytest.mark.django_db
def test_latlng_with_area_does_not_call_probe_findplace(client, google_calls):
    """lat/lng が来ていれば area があっても probe 由来のGoogle呼び出しは0回。"""
    res = _post(
        client,
        {
            "query": "縁結び 徒歩",
            "lat": 35.6812,
            "lng": 139.7671,
            "area": AREA,
            "candidates": [CANDIDATE_WITH_ADDRESS],
        },
    )

    assert res.status_code == 200, res.content
    assert google_calls["geocode"] == 0
    assert AREA not in google_calls["findplace_inputs"]


@pytest.mark.django_db
def test_location_object_with_area_does_not_call_probe_findplace(client, google_calls):
    """location:{lat,lng} が来ていれば area があっても Geocoding は0回。"""
    res = _post(
        client,
        {
            "query": "縁結び 徒歩",
            "location": {"lat": 35.6812, "lng": 139.7671},
            "area": AREA,
            "candidates": [CANDIDATE_WITH_ADDRESS],
        },
    )

    assert res.status_code == 200, res.content
    assert google_calls["geocode"] == 0
    assert AREA not in google_calls["findplace_inputs"]


@pytest.mark.django_db
def test_location_object_only_does_not_call_geocoding(client, google_calls):
    """location:{lat,lng} のみ（area なし）なら Geocoding は0回。"""
    res = _post(
        client,
        {
            "query": "縁結び 徒歩",
            "location": {"lat": 35.6812, "lng": 139.7671},
            "candidates": [CANDIDATE_WITH_ADDRESS],
        },
    )

    assert res.status_code == 200, res.content
    assert google_calls["geocode"] == 0
    assert AREA not in google_calls["findplace_inputs"]


@pytest.mark.django_db
def test_area_only_calls_geocoding_once_and_no_probe_findplace(client, google_calls):
    """area のみなら location 解決用の Geocoding が1回だけ。Find Place は0回。"""
    res = _post(
        client,
        {
            "query": "縁結び 徒歩",
            "area": AREA,
            "candidates": [CANDIDATE_WITH_ADDRESS],
        },
    )

    assert res.status_code == 200, res.content
    assert google_calls["geocode"] == 1
    assert AREA not in google_calls["findplace_inputs"]


@pytest.mark.django_db
def test_latlng_only_does_not_call_geocoding(client, google_calls):
    """lat/lng のみなら Geocoding は0回。"""
    res = _post(
        client,
        {
            "query": "縁結び 徒歩",
            "lat": 35.6812,
            "lng": 139.7671,
            "candidates": [CANDIDATE_WITH_ADDRESS],
        },
    )

    assert res.status_code == 200, res.content
    assert google_calls["geocode"] == 0
    assert AREA not in google_calls["findplace_inputs"]


@pytest.mark.django_db
def test_quota_blocked_calls_no_google_api(client, google_calls, monkeypatch):
    """quota で弾かれた場合は Geocoding / Find Place とも0回。"""

    def _fake_check_quota(*args, **kwargs):
        return SimpleNamespace(allowed=False, remaining=0, limit=1, unlimited=False)

    monkeypatch.setattr("temples.api_views_concierge.check_quota", _fake_check_quota)

    res = _post(
        client,
        {
            "query": "縁結び 徒歩",
            "area": AREA,
            "candidates": [CANDIDATE_WITH_ADDRESS],
        },
    )

    assert res.status_code == 200, res.content
    assert res.json()["limitReached"] is True
    # quota で弾かれた場合は recommendation 経路へ入らないため Find Place も総数0
    assert google_calls["geocode"] == 0
    assert google_calls["findplacefromtext"] == 0
