# -*- coding: utf-8 -*-
import json

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from temples.models import ConciergeUsage

URL = "/api/concierge/chat/"


def _normal_recs():
    return {
        "recommendations": [{"name": "A", "reason": "ok", "reason_source": "reason:matched_need_tags"}],
        "_signals": {
            "result_state": {
                "matched_count": 1,
                "pool_count": 1,
                "displayed_count": 1,
                "fallback_mode": "none",
            }
        },
    }


def _fallback_recs():
    return {
        "recommendations": [
            {"name": "A", "reason": "ok", "reason_source": "reason:fallback"},
            {"name": "B", "reason": "ok", "reason_source": "reason:fallback"},
        ],
        "_signals": {
            "result_state": {
                "matched_count": 0,
                "pool_count": 2,
                "displayed_count": 2,
                "fallback_mode": "nearby_unfiltered",
                "fallback_reason_ja": "条件に一致する神社が見つかりませんでした（0件）",
                "ui_disclaimer_ja": "代わりに近い神社を表示しています（条件は反映されていません）",
                "requested_extra_condition": None,
            }
        },
    }


@pytest.mark.django_db
def test_chat_response_matrix_message_mode_normal_flow(client, monkeypatch):
    monkeypatch.setattr("temples.api_views_concierge.build_chat_candidates", lambda **kwargs: [])
    monkeypatch.setattr("temples.api_views_concierge.build_chat_recommendations", lambda **kwargs: _normal_recs())

    payload = {"message": "近場で参拝したい", "lat": 35.0, "lng": 139.0}
    r = client.post(URL, data=json.dumps(payload), content_type="application/json")
    assert r.status_code == 200

    body = r.json()
    assert isinstance(body["reply"], str)
    assert body["reply"].startswith("候補: ")
    assert "recommendations" in body["data"]
    assert "_signals" in body["data"]


@pytest.mark.django_db
def test_chat_response_matrix_query_mode_normal_flow(client, monkeypatch):
    monkeypatch.setattr("temples.api_views_concierge.build_chat_candidates", lambda **kwargs: [])
    monkeypatch.setattr("temples.api_views_concierge.build_chat_recommendations", lambda **kwargs: _normal_recs())

    payload = {"query": "近場で参拝したい", "lat": 35.0, "lng": 139.0}
    r = client.post(URL, data=json.dumps(payload), content_type="application/json")
    assert r.status_code == 200

    body = r.json()
    assert body["reply"] is None
    assert "recommendations" in body["data"]
    assert "_signals" in body["data"]


@pytest.mark.django_db
def test_chat_response_matrix_message_mode_fallback_flow(client, monkeypatch):
    monkeypatch.setattr("temples.api_views_concierge.build_chat_candidates", lambda **kwargs: [])
    monkeypatch.setattr("temples.api_views_concierge.build_chat_recommendations", lambda **kwargs: _fallback_recs())

    payload = {"message": "近場で参拝したい", "lat": 35.0, "lng": 139.0}
    r = client.post(URL, data=json.dumps(payload), content_type="application/json")
    assert r.status_code == 200

    body = r.json()
    result_state = body["data"]["_signals"]["result_state"]

    assert body["reply"].startswith("候補: ")
    assert result_state["fallback_mode"] == "nearby_unfiltered"
    assert result_state["displayed_count"] == len(body["data"]["recommendations"])
    assert result_state["pool_count"] == len(body["data"]["recommendations"])


@pytest.mark.django_db
def test_chat_response_matrix_query_mode_fallback_flow(client, monkeypatch):
    monkeypatch.setattr("temples.api_views_concierge.build_chat_candidates", lambda **kwargs: [])
    monkeypatch.setattr("temples.api_views_concierge.build_chat_recommendations", lambda **kwargs: _fallback_recs())

    payload = {"query": "近場で参拝したい", "lat": 35.0, "lng": 139.0}
    r = client.post(URL, data=json.dumps(payload), content_type="application/json")
    assert r.status_code == 200

    body = r.json()
    result_state = body["data"]["_signals"]["result_state"]

    assert body["reply"] is None
    for k in (
        "matched_count",
        "pool_count",
        "displayed_count",
        "fallback_mode",
        "fallback_reason_ja",
        "ui_disclaimer_ja",
        "requested_extra_condition",
    ):
        assert k in result_state


@pytest.mark.django_db
def test_chat_response_matrix_message_mode_rate_limit_reached(user, settings, monkeypatch):
    settings.CONCIERGE_DAILY_FREE_LIMIT = 5
    monkeypatch.setattr("temples.api_views_concierge.build_chat_candidates", lambda **kwargs: [])

    client = APIClient()
    client.force_authenticate(user=user)

    ConciergeUsage.objects.update_or_create(
        user=user,
        date=timezone.localdate(),
        defaults={"count": settings.CONCIERGE_DAILY_FREE_LIMIT},
    )

    payload = {"message": "近場で参拝したい", "lat": 35.0, "lng": 139.0}
    r = client.post(URL, data=json.dumps(payload), content_type="application/json")
    assert r.status_code == 200

    body = r.json()
    assert body["plan"] == "free"
    assert body["remaining"] == 0
    assert body["limit"] == 5
    assert body["limitReached"] is True
    assert body["reply"] == "候補: "
