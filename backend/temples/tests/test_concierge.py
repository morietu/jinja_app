import json
import re
import pytest

from temples.llm.backfill import fill_locations, _shorten_japanese_address as S

def test_shorten_examples():
    assert S("日本、〒107-0052 東京都港区赤坂6丁目10−12") == "港区赤坂"
    assert S("〒150-0041 東京都渋谷区神南1-1-1") == "渋谷区神南"
    assert S("東京都千代田区富士見2丁目") == "千代田区富士見"

def test_fill_locations_backfills_and_shortens(req_history):
    data = {"recommendations": [{"name": "赤坂氷川神社"}]}
    bias = {"lat": 35.6812, "lng": 139.7671, "radius": 5000}
    out = fill_locations(data, candidates=[], bias=bias, shorten=True)
    loc = out["recommendations"][0]["location"]
    assert loc == "港区赤坂"
    # findplace → details が叩かれていること
    assert any("findplacefromtext" in u for (u, _) in req_history)
    assert any("place/details" in u for (u, _) in req_history)

def test_fill_locations_prefers_candidate_address_without_requests(req_history):
    before = len(req_history)
    data = {"recommendations": [{"name": "赤坂氷川神社"}]}
    candidates = [{"name": "赤坂氷川神社", "formatted_address": "日本、〒107-0052 東京都港区赤坂6丁目10−12"}]
    out = fill_locations(data, candidates=candidates, bias=None, shorten=True)
    loc = out["recommendations"][0]["location"]
    assert loc == "港区赤坂"
    # 既に住所があるので外部APIを呼ばない（履歴が増えていない）
    assert len(req_history) == before

@pytest.mark.django_db
def test_api_accepts_area_string_and_shortens(client, endpoint_path, req_history):
    payload = {
        "query": "縁結び 徒歩",
        "area": "港区赤坂",
        "candidates": [{"name": "赤坂氷川神社"}],
    }
    res = client.post(endpoint_path, data=json.dumps(payload), content_type="application/json")
    assert res.status_code == 200
    data = res.json()["data"]["recommendations"][0]
    assert data["name"] == "赤坂氷川神社"
    assert data["location"] == "港区赤坂"  # area→座標化→短縮

@pytest.mark.django_db
def test_api_radius_clip_to_50km_and_passed(client, endpoint_path, req_history):
    payload = {
        "query": "縁結び",
        "lat": 35.6812, "lng": 139.7671,
        "radius_m": 60000,  # → 50000 にクリップされる想定
        "candidates": [{"name": "赤坂氷川神社"}],
    }
    res = client.post(endpoint_path, data=json.dumps(payload), content_type="application/json")
    assert res.status_code == 200
    # findplace 呼び出しの locationbias を検証
    locbias = [p.get("locationbias") for (u, p) in req_history if "findplacefromtext" in u]
    assert any(lb and lb.startswith("circle:50000@35.6812,139.7671") for lb in locbias)

@pytest.mark.django_db
def test_api_radius_km_5km_passed(client, endpoint_path, req_history):
    payload = {
        "query": "縁結び 徒歩",
        "lat": 35.6812, "lng": 139.7671,
        "radius_km": 5,  # → 5000m
        "candidates": [{"name": "赤坂氷川神社"}],
    }
    res = client.post(endpoint_path, data=json.dumps(payload), content_type="application/json")
    assert res.status_code == 200
    # 5km がそのまま locationbias に反映される
    locbias = [p.get("locationbias") for (u, p) in req_history if "findplacefromtext" in u]
    assert any(lb and lb.startswith("circle:5000@35.6812,139.7671") for lb in locbias)
