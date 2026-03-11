# -*- coding: utf-8 -*-
import json
from types import SimpleNamespace

import pytest
from rest_framework.test import APIClient

URL = "/api/concierge/chat/"


def _stub_candidates(monkeypatch):
    monkeypatch.setattr("temples.api_views_concierge.build_chat_candidates", lambda **kwargs: [])


def _stub_recommendations(monkeypatch, recommendations):
    monkeypatch.setattr(
        "temples.api_views_concierge.build_chat_recommendations",
        lambda **kwargs: {"recommendations": recommendations},
    )


@pytest.mark.django_db
def test_chat_response_includes_base_contract_fields(client, monkeypatch):
    _stub_candidates(monkeypatch)
    _stub_recommendations(monkeypatch, [{"name": "神社A", "reason": "ok", "reason_source": "reason:test"}])

    r = client.post(
        URL,
        data=json.dumps({"query": "近場で参拝したい", "lat": 35.0, "lng": 139.0}),
        content_type="application/json",
    )
    assert r.status_code == 200

    body = r.json()
    for key in ("ok", "intent", "data", "_debug"):
        assert key in body


@pytest.mark.django_db
def test_chat_response_message_mode_reply_prefix_and_names(client, monkeypatch):
    _stub_candidates(monkeypatch)
    _stub_recommendations(
        monkeypatch,
        [
            {"name": "神社A", "reason": "ok", "reason_source": "reason:test"},
            {"display_name": "神社B", "reason": "ok", "reason_source": "reason:test"},
        ],
    )

    r = client.post(
        URL,
        data=json.dumps({"message": "近場で参拝したい", "lat": 35.0, "lng": 139.0}),
        content_type="application/json",
    )
    assert r.status_code == 200

    reply = r.json()["reply"]
    assert isinstance(reply, str)
    assert reply.startswith("候補: ")
    assert "神社A" in reply
    assert "神社B" in reply


@pytest.mark.django_db
def test_chat_response_query_mode_reply_is_none(client, monkeypatch):
    _stub_candidates(monkeypatch)
    _stub_recommendations(monkeypatch, [{"name": "神社A", "reason": "ok", "reason_source": "reason:test"}])

    r = client.post(
        URL,
        data=json.dumps({"query": "近場で参拝したい", "lat": 35.0, "lng": 139.0}),
        content_type="application/json",
    )
    assert r.status_code == 200
    assert r.json()["reply"] is None


@pytest.mark.django_db
def test_chat_response_authenticated_non_premium_includes_remaining_and_limit(user, monkeypatch):
    _stub_candidates(monkeypatch)
    _stub_recommendations(monkeypatch, [{"name": "神社A", "reason": "ok", "reason_source": "reason:test"}])
    monkeypatch.setattr("temples.api_views_concierge.is_premium_for_user", lambda _u: False)

    client = APIClient()
    client.force_authenticate(user=user)

    r = client.post(
        URL,
        data=json.dumps({"query": "近場で参拝したい", "lat": 35.0, "lng": 139.0}),
        content_type="application/json",
    )
    assert r.status_code == 200

    body = r.json()
    assert "remaining_free" in body
    assert "limit" in body


@pytest.mark.django_db
def test_chat_response_anonymous_does_not_include_remaining_or_limit(client, monkeypatch):
    _stub_candidates(monkeypatch)
    _stub_recommendations(monkeypatch, [{"name": "神社A", "reason": "ok", "reason_source": "reason:test"}])

    r = client.post(
        URL,
        data=json.dumps({"query": "近場で参拝したい", "lat": 35.0, "lng": 139.0}),
        content_type="application/json",
    )
    assert r.status_code == 200

    body = r.json()
    assert "remaining_free" not in body
    assert "limit" not in body


@pytest.mark.django_db
def test_chat_response_includes_thread_id_when_append_chat_succeeds(user, monkeypatch):
    _stub_candidates(monkeypatch)
    _stub_recommendations(monkeypatch, [{"name": "神社A", "reason": "ok", "reason_source": "reason:test"}])
    monkeypatch.setattr("temples.api_views_concierge.is_premium_for_user", lambda _u: False)
    monkeypatch.setattr(
        "temples.api_views_concierge.append_chat",
        lambda **kwargs: SimpleNamespace(thread=SimpleNamespace(id=123)),
    )

    client = APIClient()
    client.force_authenticate(user=user)

    r = client.post(
        URL,
        data=json.dumps({"query": "近場で参拝したい", "lat": 35.0, "lng": 139.0}),
        content_type="application/json",
    )
    assert r.status_code == 200
    assert r.json()["thread"]["id"] == 123


@pytest.mark.django_db
def test_chat_response_has_no_thread_when_append_chat_not_executed_for_anonymous(client, monkeypatch):
    _stub_candidates(monkeypatch)
    _stub_recommendations(monkeypatch, [{"name": "神社A", "reason": "ok", "reason_source": "reason:test"}])

    called = {"append_chat": 0}

    def _append_chat_should_not_run(**kwargs):
        called["append_chat"] += 1
        return SimpleNamespace(thread=SimpleNamespace(id=1))

    monkeypatch.setattr("temples.api_views_concierge.append_chat", _append_chat_should_not_run)

    r = client.post(
        URL,
        data=json.dumps({"query": "近場で参拝したい", "lat": 35.0, "lng": 139.0}),
        content_type="application/json",
    )
    assert r.status_code == 200

    body = r.json()
    assert "thread" not in body
    assert called["append_chat"] == 0
