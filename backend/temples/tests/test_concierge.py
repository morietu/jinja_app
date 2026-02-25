import json
import re

import pytest
from temples.llm.backfill import _shorten_japanese_address as S
from temples.llm.backfill import fill_locations
from temples.services import google_places as GP
from temples.services.concierge_plan import _coords_from_locationbias


# ------------------------------------------------------------------ #
# ヘルパー：locationbias の一覧を req_history から取り出す
# ------------------------------------------------------------------ #
def _get_locbias_list(req_history: list) -> list:
    """findplacefromtext を呼んだときの locationbias だけ集める"""
    return [
        params.get("locationbias")
        for url, params in req_history
        if "findplacefromtext" in url
    ]


# ------------------------------------------------------------------ #
# _shorten_japanese_address のユニットテスト
# ------------------------------------------------------------------ #
def test_shorten_examples():
    assert S("日本、〒107-0052 東京都港区赤坂6丁目10−12") == "港区赤坂"
    assert S("〒150-0041 東京都渋谷区神南1-1-1") == "渋谷区神南"
    assert S("東京都千代田区富士見2丁目") == "千代田区富士見"


# ------------------------------------------------------------------ #
# fill_locations のテスト
# ------------------------------------------------------------------ #
def test_fill_locations_backfills_and_shortens(req_history):
    data = {"recommendations": [{"name": "赤坂氷川神社"}]}
    bias = {"lat": 35.6812, "lng": 139.7671, "radius": 5000}

    out = fill_locations(data, candidates=[], bias=bias, shorten=True)
    loc = out["recommendations"][0]["location"]

    assert loc == "港区赤坂"
    # findplace → details の両方が呼ばれていること
    assert any("findplacefromtext" in url for url, _ in req_history), \
        "findplacefromtext が呼ばれていません"
    assert any("place/details" in url for url, _ in req_history), \
        "place/details が呼ばれていません"


def test_fill_locations_prefers_candidate_address_without_requests(req_history):
    """candidates に住所があるときは外部 API を呼ばない"""
    before = len(req_history)
    data = {"recommendations": [{"name": "赤坂氷川神社"}]}
    candidates = [
        {
            "name": "赤坂氷川神社",
            "formatted_address": "日本、〒107-0052 東京都港区赤坂6丁目10−12",
        }
    ]

    out = fill_locations(data, candidates=candidates, bias=None, shorten=True)
    loc = out["recommendations"][0]["location"]

    assert loc == "港区赤坂"
    assert len(req_history) == before, \
        f"外部 API が {len(req_history) - before} 回余分に呼ばれました"


# ------------------------------------------------------------------ #
# API エンドポイントのテスト
# ------------------------------------------------------------------ #
@pytest.mark.django_db
def test_api_radius_km_5km_passed(client, endpoint_path, req_history):
    payload = {
        "query": "縁結び 徒歩",
        "language": "ja",
        "lat": 35.0,
        "lng": 135.0,
        "radius_km": "5km",
        "transportation": "walk",
    }

    before = len(req_history)

    res = client.post(endpoint_path, data=json.dumps(payload), content_type="application/json")
    assert res.status_code == 200, res.content

    # このテストで増えた分だけを見る（混線防止）
    new_calls = req_history[before:]
    locbias_list = _get_locbias_list(new_calls)

    lb = next((lb for lb in locbias_list if lb), None)
    assert lb is not None, f"locationbias が見つかりません: {locbias_list}"
    
    # 半径だけ固定（表記揺れ耐性）
    assert lb.startswith("circle:5000@"), lb

    # 座標はパースして数値比較（表記揺れ耐性）
    pt = _coords_from_locationbias(lb)
    assert pt is not None
    lat, lng = pt

    # payload を尊重するのが正しい仕様
    assert abs(lat - 35.0) < 1e-9, lat
    assert abs(lng - 135.0) < 1e-9, lng


@pytest.mark.django_db
def test_api_accepts_area_string_and_shortens(client, endpoint_path, req_history):
    """area 文字列を渡すと location が短縮形になる"""
    payload = {
        "query": "縁結び 徒歩",
        "area": "港区赤坂",
        "candidates": [{"name": "赤坂氷川神社"}],
    }
    res = client.post(
        endpoint_path,
        data=json.dumps(payload),
        content_type="application/json",
    )
    assert res.status_code == 200, res.content

    data = res.json()["data"]["recommendations"][0]
    assert data["name"] == "赤坂氷川神社"
    assert data["location"] == "港区赤坂", \
        f"location が期待値と違います: {data['location']}"


@pytest.mark.django_db
def test_api_radius_clip_to_50km_and_passed(client, endpoint_path, req_history):
    payload = {
        "query": "縁結び",
        "lat": 35.6812,
        "lng": 139.7671,
        "radius_m": 60000,  # → 50000 にクリップされる想定
        "candidates": [{"name": "赤坂氷川神社"}],
    }

    before = len(req_history)

    res = client.post(
        endpoint_path,
        data=json.dumps(payload),
        content_type="application/json",
    )
    assert res.status_code == 200, res.content

    new_calls = req_history[before:]
    locbias_list = _get_locbias_list(new_calls)

    lb = next((lb for lb in locbias_list if lb), None)
    assert lb is not None, f"locationbias が見つかりません: {locbias_list}"

    # 半径だけ固定
    assert lb.startswith("circle:50000@"), lb

    # 座標もパースして数値比較（表記揺れ耐性）
    pt = _coords_from_locationbias(lb)
    assert pt is not None
    lat, lng = pt
    assert abs(lat - 35.6812) < 1e-9, lat
    assert abs(lng - 139.7671) < 1e-9, lng
