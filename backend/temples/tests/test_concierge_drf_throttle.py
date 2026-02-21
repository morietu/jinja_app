# backend/temples/tests/test_concierge_drf_throttle.py
import pytest
from django.core.cache import cache
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

import temples.api_views_concierge as concierge_view


@pytest.fixture(autouse=True)
def _clear_throttle_cache():
    # DRF throttle は cache を使うのでテスト間汚染を消す
    cache.clear()
    yield
    cache.clear()


@pytest.fixture(autouse=True)
def _lock_concierge_rate(settings):
    # 仕様の 8/min をテスト中に固定
    settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["concierge"] = "8/min"
    # 念のため user/anon を十分大きく（他スロットルが先に刺さる事故防止）
    settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["user"] = "1000/min"
    settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["anon"] = "1000/min"


@pytest.fixture(autouse=True)
def _premium_bypass_usage(monkeypatch):
    # 独自「無料回数」ロジックを完全バイパスして DRF throttle だけを観測する
    monkeypatch.setenv("BILLING_STUB_PLAN", "premium")
    monkeypatch.setenv("BILLING_STUB_ACTIVE", "1")


@pytest.fixture(autouse=True)
def _stub_concierge(monkeypatch):
    # view内の重い処理・外部依存を封印（速度/安定性のため）
    monkeypatch.setattr(
        concierge_view,
        "extract_intent",
        lambda *a, **k: {"birthdate": None, "goriyaku": None, "extra": None},
        raising=True,
    )

    monkeypatch.setattr(
        concierge_view,
        "build_chat_candidates",
        lambda *a, **k: [],
        raising=True,
    )

    def _fake_recs(*a, **k):
        return {
            "recommendations": [{"name": "X"}],
            "_need": {"tags": [], "hits": {}},
            "_signals": {"result_state": {"fallback_mode": "none"}},
        }

    monkeypatch.setattr(
        concierge_view,
        "build_chat_recommendations",
        _fake_recs,
        raising=True,
    )


@pytest.mark.django_db
def test_concierge_drf_throttle_hits_429_on_9th_request():
    """
    concierge scope = 8/min を超えると DRF が 429 を返すこと。
    8回は200、9回目が429を期待。
    """
    client = APIClient()
    User = get_user_model()
    user = User.objects.create_user(username="th_user", password="pass1234")

    client.force_authenticate(user=user)

    # 8回は通る
    for i in range(8):
        res = client.post("/api/concierge/chat/", {"query": f"仕事運を上げたい{i}"}, format="json")
        assert res.status_code == 200

    # 9回目で 429
    res = client.post("/api/concierge/chat/", {"query": "仕事運を上げたい9"}, format="json")
    assert res.status_code == 429
