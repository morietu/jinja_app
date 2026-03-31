# -*- coding: utf-8 -*-
import json

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from temples.models import ConciergeUsage

URL = "/api/concierge/chat/"


@pytest.mark.django_db
def test_rate_limit_reached_in_message_mode_keeps_reply_and_response_contract(
    user, settings, monkeypatch
):
    settings.CONCIERGE_USE_LLM = False
    settings.CONCIERGE_DAILY_FREE_LIMIT = 5

    monkeypatch.setattr(
        "temples.api_views_concierge.build_chat_candidates",
        lambda **kwargs: [],
    )

    client = APIClient()
    client.force_authenticate(user=user)

    today = timezone.localdate()
    ConciergeUsage.objects.update_or_create(
        user=user,
        date=today,
        defaults={"count": settings.CONCIERGE_DAILY_FREE_LIMIT},
    )

    payload = {"message": "近場で参拝したい", "lat": 35.0, "lng": 139.0}
    r = client.post(URL, data=json.dumps(payload), content_type="application/json")

    assert r.status_code == 200
    body = r.json()

    assert body["ok"] is True
    assert "intent" in body
    assert "data" in body
    assert "recommendations" in body["data"]
    assert isinstance(body["data"]["recommendations"], list)
    assert "remaining" in body
    assert "limit" in body

    assert body["plan"] == "free"
    assert body["remaining"] == 0
    assert body["limit"] == settings.CONCIERGE_DAILY_FREE_LIMIT
    assert body["limitReached"] is True
    assert body["reply"].startswith("候補: ")
