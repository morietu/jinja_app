import json
import types

import pytest

from temples.llm import backfill


def make_rec(name, formatted_address=None):
    r = {"name": name}
    if formatted_address:
        r["formatted_address"] = formatted_address
    return r


def test_fill_locations_prefers_recommendation_formatted_address(req_history):
    """recommendation 自身に formatted_address がある場合はその値を優先して location が埋まる"""
    data = {"recommendations": [make_rec("神社A", formatted_address="東京都港区赤坂1-2-3")]}
    out = backfill.fill_locations(data, candidates=[], bias=None, shorten=True)
    assert "recommendations" in out
    recs = out["recommendations"]
    assert len(recs) == 1
    assert recs[0].get("location") is not None
    # 短縮されたラベル（例: 港区赤坂）を期待
    assert "港区" in recs[0]["location"] or "赤坂" in recs[0]["location"]


class DummyOrch:
    @classmethod
    def suggest(cls, *args, **kwargs):
        # テスト用に空の recommendations を返す
        return []


def test_concierge_view_fallback_when_llm_empty(monkeypatch, client):
    """LLM が空配列を返す場合でも最低1件の recommendation が返る（ビューのフォールバック）"""
    # monkeypatch で orchestrator の suggest を差し替える（ビュー側のフォールバックを誘発）
    from temples.api_views_concierge import ConciergePlanView

    monkeypatch.setattr("temples.api_views_concierge.ConciergeOrchestrator", DummyOrch)

    payload = {"query": "神社", "candidates": [{"name": "神社A"}], "bias": None}
    resp = client.post(
        "/api/concierge/plan/", data=json.dumps(payload), content_type="application/json"
    )
    assert resp.status_code == 200
    body = resp.json()
    # ConciergePlanView returns a top-level plan shape with 'data' containing recommendations
    assert "data" in body
    assert "recommendations" in body["data"]
    assert len(body["data"]["recommendations"]) >= 1
