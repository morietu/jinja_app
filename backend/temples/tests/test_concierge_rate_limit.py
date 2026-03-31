# backend/temples/tests/test_concierge_rate_limit.py
import pytest
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from temples.models import ConciergeUsage
import temples.api_views_concierge as concierge_view


@pytest.fixture(autouse=True)
def _clear_throttle_cache():
    # DRF throttle は cache を使うのでテスト間汚染を消す
    cache.clear()
    yield
    cache.clear()


@pytest.fixture(autouse=True)
def _disable_drf_throttle_for_concierge(settings):
    """
    このファイルは「無料回数(ConciergeUsage)」の挙動テスト。
    DRF側(8/min)が混ざるとノイズなので、conciergeだけ無効化する。
    """
    rates = settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]
    old = rates.get("concierge")
    rates["concierge"] = "100000/min"
    yield
    rates["concierge"] = old


@pytest.fixture(autouse=True)
def _stub_concierge(monkeypatch):
    # intent: LLM触らない
    monkeypatch.setattr(
        concierge_view,
        "extract_intent",
        lambda *a, **k: {"birthdate": None, "goriyaku": None, "extra": None},
        raising=True,
    )

    # candidates: 空でOK（軽く）
    monkeypatch.setattr(
        concierge_view,
        "build_chat_candidates",
        lambda *a, **k: [],
        raising=True,
    )

    # chat本体: 外部依存なしで固定レスポンス
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
def test_rate_limit_authenticated_user():
    client = APIClient()
    User = get_user_model()
    user = User.objects.create_user(username="user1", password="pass1234")

    today = timezone.localdate()
    ConciergeUsage.objects.filter(user=user, date=today).delete()

    client.force_authenticate(user=user)

    replies = []
    remainings = []

    for _ in range(7):
        res = client.post("/api/concierge/chat/", {"query": "仕事運を上げたい"}, format="json")
        assert res.status_code == 200
        replies.append(res.data.get("reply"))
        remainings.append(res.data.get("remaining"))

    assert remainings[:5] == [4, 3, 2, 1, 0]
    assert replies[5] == "無料で利用できる回数を使い切りました。"
    assert remainings[5] == 0
    assert replies[6] == "無料で利用できる回数を使い切りました。"
    assert remainings[6] == 0

    usage = ConciergeUsage.objects.get(user=user, date=today)
    assert usage.count == 5


@pytest.mark.django_db
def test_rate_limit_is_separated_per_user():
    client = APIClient()
    User = get_user_model()

    user_a = User.objects.create_user(username="userA", password="passA1234")
    user_b = User.objects.create_user(username="userB", password="passB1234")

    today = timezone.localdate()
    ConciergeUsage.objects.filter(user__in=[user_a, user_b], date=today).delete()

    client.force_authenticate(user=user_a)
    for _ in range(5):
        res = client.post("/api/concierge/chat/", {"query": "仕事運を上げたい"}, format="json")
        assert res.status_code == 200

    usage_a = ConciergeUsage.objects.get(user=user_a, date=today)
    assert usage_a.count == 5

    client = APIClient()
    client.force_authenticate(user=user_b)

    res = client.post("/api/concierge/chat/", {"query": "仕事運を上げたい"}, format="json")
    assert res.status_code == 200
    assert res.data["plan"] == "free"
    assert res.data["remaining"] == 4
    assert res.data["limit"] == 5
    assert res.data["limitReached"] is False

    usage_b = ConciergeUsage.objects.get(user=user_b, date=today)
    assert usage_b.count == 1


@pytest.mark.django_db
def test_guest_user_is_not_rate_limited():
    client = APIClient()

    replies = []
    bodies = []

    for _ in range(7):
        res = client.post("/api/concierge/chat/", {"query": "仕事運を上げたい"}, format="json")
        assert res.status_code == 200
        replies.append(res.data.get("reply"))
        bodies.append(res.data)

    for body in bodies:
        assert body["plan"] == "anonymous"
        assert "remaining" in body
        assert "limit" in body
        assert isinstance(body["remaining"], int)
        assert isinstance(body["limit"], int)
        assert body["limit"] == 3
        assert 0 <= body["remaining"] <= body["limit"]
        assert body["limitReached"] is False

    assert all(r != "無料で利用できる回数を使い切りました。" for r in replies)


@pytest.mark.django_db
def test_premium_user_is_not_rate_limited(monkeypatch):
    monkeypatch.setenv("BILLING_STUB_PLAN", "premium")
    monkeypatch.setenv("BILLING_STUB_ACTIVE", "1")

    client = APIClient()
    User = get_user_model()
    user = User.objects.create_user(username="premium1", password="pass1234")

    today = timezone.localdate()
    ConciergeUsage.objects.filter(user=user, date=today).delete()

    client.force_authenticate(user=user)

    replies = []
    keys_list = []

    for _ in range(7):
        res = client.post("/api/concierge/chat/", {"query": "仕事運を上げたい"}, format="json")
        assert res.status_code == 200
        replies.append(res.data.get("reply"))
        keys_list.append(set(res.data.keys()))

    assert all(r != "無料で利用できる回数を使い切りました。" for r in replies)

    for keys in keys_list:
        assert "remaining" not in keys
        assert "limit" not in keys

    assert ConciergeUsage.objects.filter(user=user, date=today).count() == 0
