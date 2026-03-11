# -*- coding: utf-8 -*-
import json

import pytest

URL = "/api/concierge/chat/"


@pytest.mark.django_db
def test_chat_promotes_filters_to_top_level_and_uses_flow_b(client, monkeypatch):
    """
    CR-001:
    filters.birthdate / filters.goriyaku_tag_ids / filters.extra_condition が
    top-level 未指定時に build_chat_recommendations へ渡ること。
    また goriyaku / extra_condition が入るので flow='B' になること。
    """
    captured = {}

    monkeypatch.setattr(
        "temples.api_views_concierge.build_chat_candidates",
        lambda **kwargs: [],
    )

    def fake_build_chat_recommendations(**kwargs):
        captured.update(kwargs)
        return {
            "recommendations": [
                {"name": "A", "reason": "ok", "breakdown": {"matched_need_tags": []}}
            ]
        }

    monkeypatch.setattr(
        "temples.api_views_concierge.build_chat_recommendations",
        fake_build_chat_recommendations,
    )

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

    assert captured["query"] == "近場で参拝したい"
    assert captured["birthdate"] == "1984-05-15"
    assert captured["goriyaku_tag_ids"] == [10, 20]
    assert captured["extra_condition"] == "静か"
    assert captured["flow"] == "B"


@pytest.mark.django_db
def test_chat_top_level_values_override_filters_values(client, monkeypatch):
    """
    CR-001:
    top-level と filters の両方に値があるときは top-level 優先。
    互換吸い上げで上書き事故を起こさないことを固定する。
    """
    captured = {}

    monkeypatch.setattr(
        "temples.api_views_concierge.build_chat_candidates",
        lambda **kwargs: [],
    )

    def fake_build_chat_recommendations(**kwargs):
        captured.update(kwargs)
        return {
            "recommendations": [
                {"name": "A", "reason": "ok", "breakdown": {"matched_need_tags": []}}
            ]
        }

    monkeypatch.setattr(
        "temples.api_views_concierge.build_chat_recommendations",
        fake_build_chat_recommendations,
    )

    payload = {
        "message": "転職が気になる",
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

    assert captured["query"] == "転職が気になる"
    assert captured["birthdate"] == "1990-01-01"
    assert captured["goriyaku_tag_ids"] == [999]
    assert captured["extra_condition"] == "にぎやか"
    assert captured["flow"] == "B"
