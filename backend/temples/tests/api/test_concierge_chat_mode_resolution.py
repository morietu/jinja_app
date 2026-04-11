# backend/temples/tests/api/test_concierge_chat_mode_resolution.py

from types import SimpleNamespace

import pytest
from rest_framework.test import APIClient


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def patch_chat_dependencies(monkeypatch):
    captured: dict = {}

    def fake_resolve_plan_context(request):
        return SimpleNamespace(
            plan="anonymous",
            anon_id="anon-test-id",
        )

    def fake_check_quota(plan_context, feature):
        return SimpleNamespace(
            allowed=True,
            unlimited=False,
            remaining=5,
            limit=5,
        )

    def fake_consume_quota(plan_context, feature):
        return None

    def fake_build_chat_candidates(**kwargs):
        return [
            {
                "name": "明治神宮",
                "display_name": "明治神宮",
                "place_id": "p1",
                "shrine_id": 1,
                "astro_elements": ["火"],
                "astro_tags": ["courage"],
                "goriyaku_tag_ids": [1],
                "goriyaku": "開運",
                "description": "前向きな一歩を後押しする神社",
                "popular_score": 8.0,
                "distance_m": 500,
            }
        ]

    def fake_build_chat_recommendations(
        *,
        query,
        language,
        candidates,
        bias,
        birthdate,
        goriyaku_tag_ids,
        extra_condition,
        public_mode,
        flow,
    ):
        captured["query"] = query
        captured["birthdate"] = birthdate
        captured["public_mode"] = public_mode
        captured["flow"] = flow
        captured["candidates_count"] = len(candidates or [])

        return {
            "recommendations": [
                {
                    "name": "明治神宮",
                    "display_name": "明治神宮",
                    "reason": "test",
                    "score": 1.0,
                    "breakdown": {
                        "score_element": 2,
                        "score_need": 0,
                        "score_popular": 0.8,
                        "score_total": 1.0,
                        "weights": {
                            "element": 0.8,
                            "need": 0.2,
                            "popular": 0.0,
                        },
                        "matched_need_tags": [],
                    },
                }
            ],
            "_signals": {
                "mode": {
                    "mode": public_mode,
                    "flow": flow,
                    "weights": {
                        "element": 0.8 if public_mode == "compat" else 0.6,
                        "need": 0.2 if public_mode == "compat" else 0.3,
                        "popular": 0.0 if public_mode == "compat" else 0.1,
                    },
                    "astro_bonus_enabled": True,
                },
                "llm": {
                    "enabled": False,
                    "used": False,
                },
                "result_state": {
                    "matched_count": 1,
                    "fallback_mode": "none",
                },
            },
            "_need": {
                "tags": [],
            },
        }

    def fake_append_chat(
        *,
        user,
        anonymous_id,
        query,
        reply_text,
        thread_id,
        recommendations,
        recommendations_v2,
    ):
        captured["saved_query"] = query
        return SimpleNamespace(thread=SimpleNamespace(id=999))

    def fake_attach_anonymous_cookie(response, anon_id):
        return response

    def fake_extract_intent(text):
        return {"kind": "general"}

    monkeypatch.setattr(
        "temples.api_views_concierge.resolve_plan_context",
        fake_resolve_plan_context,
    )
    monkeypatch.setattr(
        "temples.api_views_concierge.check_quota",
        fake_check_quota,
    )
    monkeypatch.setattr(
        "temples.api_views_concierge.consume_quota",
        fake_consume_quota,
    )
    monkeypatch.setattr(
        "temples.api_views_concierge.build_chat_candidates",
        fake_build_chat_candidates,
    )
    monkeypatch.setattr(
        "temples.api_views_concierge.build_chat_recommendations",
        fake_build_chat_recommendations,
    )
    monkeypatch.setattr(
        "temples.api_views_concierge.append_chat",
        fake_append_chat,
    )
    monkeypatch.setattr(
        "temples.api_views_concierge.attach_anonymous_cookie",
        fake_attach_anonymous_cookie,
    )
    monkeypatch.setattr(
        "temples.api_views_concierge.extract_intent",
        fake_extract_intent,
    )
    monkeypatch.setattr(
        "temples.api_views_concierge._probe_area_locationbias_for_chat",
        lambda area=None: None,
    )

    return captured


@pytest.mark.django_db
def test_chat_birthdate_only_resolves_to_compat(client, patch_chat_dependencies):
    res = client.post(
        "/api/concierge/chat/",
        {
            "birthdate": "1991-05-10",
            "lat": 35.681236,
            "lng": 139.767125,
        },
        format="json",
    )

    assert res.status_code == 200, res.content

    body = res.json()

    assert body["_debug"]["mode"] == "compat"
    assert body["_debug"]["flow"] == "B"

    assert patch_chat_dependencies["public_mode"] == "compat"
    assert patch_chat_dependencies["flow"] == "B"
    assert patch_chat_dependencies["birthdate"] == "1991-05-10"
    assert patch_chat_dependencies["query"] == ""

    signals = body["data"].get("_signals") or {}
    mode_meta = signals.get("mode") or {}
    assert mode_meta.get("mode") == "compat"
    assert mode_meta.get("flow") == "B"


@pytest.mark.django_db
def test_chat_birthdate_rescue_from_query_resolves_to_compat(client, patch_chat_dependencies):
    res = client.post(
        "/api/concierge/chat/",
        {
            "query": "1991-05-10",
            "lat": 35.681236,
            "lng": 139.767125,
        },
        format="json",
    )

    assert res.status_code == 200, res.content

    body = res.json()

    assert body["_debug"]["mode"] == "compat"
    assert body["_debug"]["flow"] == "B"

    assert patch_chat_dependencies["public_mode"] == "compat"
    assert patch_chat_dependencies["flow"] == "B"
    assert patch_chat_dependencies["birthdate"] == "1991-05-10"
    assert patch_chat_dependencies["query"] == ""

    # append_chat に保存される query も rescue 後の文脈になっていることを確認
    assert patch_chat_dependencies["saved_query"] == "生年月日から相性を見てほしい"

    signals = body["data"].get("_signals") or {}
    mode_meta = signals.get("mode") or {}
    assert mode_meta.get("mode") == "compat"
    assert mode_meta.get("flow") == "B"


@pytest.mark.django_db
def test_chat_explicit_need_wins_even_with_birthdate(client, patch_chat_dependencies):
    res = client.post(
        "/api/concierge/chat/",
        {
            "mode": "need",
            "query": "試験に向けて気持ちを整えたい",
            "birthdate": "1991-05-10",
            "lat": 35.681236,
            "lng": 139.767125,
        },
        format="json",
    )

    assert res.status_code == 200, res.content

    body = res.json()

    assert body["_debug"]["mode"] == "need"
    assert patch_chat_dependencies["public_mode"] == "need"
    assert patch_chat_dependencies["flow"] == "A"
    assert patch_chat_dependencies["query"] == "試験に向けて気持ちを整えたい"
    assert patch_chat_dependencies["birthdate"] == "1991-05-10"
