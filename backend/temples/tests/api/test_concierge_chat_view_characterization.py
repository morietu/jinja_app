# -*- coding: utf-8 -*-
import json

import pytest

URL = "/api/concierge/chat/"


def _stub_recommendations(monkeypatch):
    captured = {}

    def fake_build_chat_recommendations(**kwargs):
        captured.update(kwargs)
        return {
            "recommendations": [
                {
                    "name": "神社A",
                    "reason": "ok",
                    "reason_source": "reason:test",
                    "breakdown": {"matched_need_tags": []},
                }
            ]
        }

    monkeypatch.setattr(
        "temples.api_views_concierge.build_chat_recommendations",
        fake_build_chat_recommendations,
    )
    return captured


@pytest.mark.django_db
def test_chat_view_message_has_priority_over_query(client, monkeypatch):
    captured = _stub_recommendations(monkeypatch)
    monkeypatch.setattr("temples.api_views_concierge.build_chat_candidates", lambda **kwargs: [])

    payload = {
        "message": "message優先",
        "query": "queryは無視される",
        "lat": 35.0,
        "lng": 139.0,
    }
    r = client.post(URL, data=json.dumps(payload), content_type="application/json")
    assert r.status_code == 200
    assert captured["query"] == "message優先"


@pytest.mark.django_db
def test_chat_view_promotes_filters_to_top_level_when_missing(client, monkeypatch):
    captured = _stub_recommendations(monkeypatch)
    monkeypatch.setattr("temples.api_views_concierge.build_chat_candidates", lambda **kwargs: [])

    payload = {
        "message": "近場で参拝したい",
        "lat": 35.0,
        "lng": 139.0,
        "filters": {
            "birthdate": "1984-05-15",
            "goriyaku_tag_ids": [10, 20],
            "extra_condition": "静か",
        },
    }
    r = client.post(URL, data=json.dumps(payload), content_type="application/json")
    assert r.status_code == 200

    assert captured["birthdate"] == "1984-05-15"
    assert captured["goriyaku_tag_ids"] == [10, 20]
    assert captured["extra_condition"] == "静か"


@pytest.mark.django_db
def test_chat_view_top_level_wins_over_filters(client, monkeypatch):
    captured = _stub_recommendations(monkeypatch)
    monkeypatch.setattr("temples.api_views_concierge.build_chat_candidates", lambda **kwargs: [])

    payload = {
        "message": "近場で参拝したい",
        "lat": 35.0,
        "lng": 139.0,
        "birthdate": "1990-01-01",
        "goriyaku_tag_ids": [999],
        "extra_condition": "にぎやか",
        "filters": {
            "birthdate": "1984-05-15",
            "goriyaku_tag_ids": [10, 20],
            "extra_condition": "静か",
        },
    }
    r = client.post(URL, data=json.dumps(payload), content_type="application/json")
    assert r.status_code == 200

    assert captured["birthdate"] == "1990-01-01"
    assert captured["goriyaku_tag_ids"] == [999]
    assert captured["extra_condition"] == "にぎやか"


@pytest.mark.django_db
def test_chat_view_uses_area_geocode_when_latlng_absent(client, monkeypatch):
    captured_recs = _stub_recommendations(monkeypatch)
    captured_cands = {}

    monkeypatch.setattr(
        "temples.api_views_concierge._geocode_area_for_chat",
        lambda **kwargs: (35.6812, 139.7671),
    )

    def fake_build_chat_candidates(**kwargs):
        captured_cands.update(kwargs)
        return []

    monkeypatch.setattr("temples.api_views_concierge.build_chat_candidates", fake_build_chat_candidates)

    payload = {"message": "東京駅周辺", "area": "東京駅"}
    r = client.post(URL, data=json.dumps(payload), content_type="application/json")
    assert r.status_code == 200

    assert captured_cands["lat"] == pytest.approx(35.6812)
    assert captured_cands["lng"] == pytest.approx(139.7671)
    assert captured_recs["bias"]["lat"] == pytest.approx(35.6812)
    assert captured_recs["bias"]["lng"] == pytest.approx(139.7671)


@pytest.mark.django_db
def test_chat_view_prefers_direct_latlng_even_with_area(client, monkeypatch):
    captured_recs = _stub_recommendations(monkeypatch)
    captured_cands = {}

    monkeypatch.setattr(
        "temples.api_views_concierge._geocode_area_for_chat",
        lambda **kwargs: (35.0, 140.0),
    )

    def fake_build_chat_candidates(**kwargs):
        captured_cands.update(kwargs)
        return []

    monkeypatch.setattr("temples.api_views_concierge.build_chat_candidates", fake_build_chat_candidates)

    payload = {"message": "近場で参拝したい", "area": "東京駅", "lat": 35.1, "lng": 139.1}
    r = client.post(URL, data=json.dumps(payload), content_type="application/json")
    assert r.status_code == 200

    assert captured_cands["lat"] == pytest.approx(35.1)
    assert captured_cands["lng"] == pytest.approx(139.1)
    assert captured_recs["bias"]["lat"] == pytest.approx(35.1)
    assert captured_recs["bias"]["lng"] == pytest.approx(139.1)


@pytest.mark.django_db
@pytest.mark.parametrize(
    "extra,expected_flow",
    [
        ({}, "A"),
        ({"goriyaku_tag_ids": [1]}, "B"),
        ({"extra_condition": "静か"}, "B"),
    ],
)
def test_chat_view_flow_detection_contract(client, monkeypatch, extra, expected_flow):
    captured = _stub_recommendations(monkeypatch)
    monkeypatch.setattr("temples.api_views_concierge.build_chat_candidates", lambda **kwargs: [])

    payload = {"query": "近場で参拝したい", "lat": 35.0, "lng": 139.0, **extra}
    r = client.post(URL, data=json.dumps(payload), content_type="application/json")
    assert r.status_code == 200
    assert captured["flow"] == expected_flow
