"""
Stripe Customer Portal の「期間終了時に解約」予約を Backend へ永続化する契約。

方針:
- UserProfile.cancel_at_period_end は Stripe subscription の値のミラーでしかない
- Premium / Free の判定には使わない（判定は subscription_status + current_period_end）
- Billing status 取得のたびに Stripe API は叩かず、DB を正本として返す
"""

import hashlib
import hmac
import json
import time

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from users.models import UserProfile

WEBHOOK_URL = "/api/billings/webhook/"
STATUS_URL = "/api/billings/status/"


def _enable_stripe_billing(settings, monkeypatch):
    monkeypatch.setenv("BILLING_PROVIDER", "stripe")
    settings.BILLING_PROVIDER = "stripe"
    settings.STRIPE_WEBHOOK_SECRET = "whsec_test"


def _payload(event_type: str, obj: dict) -> bytes:
    return json.dumps(
        {
            "id": f"evt_{event_type.replace('.', '_')}",
            "object": "event",
            "type": event_type,
            "data": {"object": obj},
        },
        separators=(",", ":"),
    ).encode()


def _signature(payload: bytes, secret: str) -> str:
    ts = str(int(time.time()))
    digest = hmac.new(secret.encode(), ts.encode() + b"." + payload, hashlib.sha256).hexdigest()
    return f"t={ts},v1={digest}"


def _post_signed(client: APIClient, payload: bytes, secret: str):
    return client.post(
        WEBHOOK_URL,
        data=payload,
        content_type="application/json",
        HTTP_STRIPE_SIGNATURE=_signature(payload, secret),
    )


def _subscription_obj(*, customer: str, cancel_at_period_end, period_end: int, status="active"):
    obj = {
        "id": "sub_cape_sync",
        "customer": customer,
        "status": status,
        "current_period_end": period_end,
        "items": {"data": [{"price": {"id": "price_premium"}}]},
    }
    if cancel_at_period_end is not None:
        obj["cancel_at_period_end"] = cancel_at_period_end
    return obj


def _user_with_customer(username: str, customer_id: str, **profile_defaults):
    user = get_user_model().objects.create_user(username=username)
    UserProfile.objects.update_or_create(
        user=user, defaults={"stripe_customer_id": customer_id, **profile_defaults}
    )
    return user


@pytest.mark.django_db
def test_user_profile_cancel_at_period_end_defaults_to_false():
    # UserProfile は user 作成時に signal で自動生成される
    user = get_user_model().objects.create_user(username="cape-default-user")
    profile = UserProfile.objects.get(user=user)

    assert profile.cancel_at_period_end is False
    profile.refresh_from_db()
    assert profile.cancel_at_period_end is False


@pytest.mark.django_db
def test_subscription_created_with_cancel_at_period_end_true_is_persisted(settings, monkeypatch):
    _enable_stripe_billing(settings, monkeypatch)
    period_end = int(time.time()) + 3600
    user = _user_with_customer("cape-created-true", "cus_cape_created")
    client = APIClient()

    res = _post_signed(
        client,
        _payload(
            "customer.subscription.created",
            _subscription_obj(
                customer="cus_cape_created", cancel_at_period_end=True, period_end=period_end
            ),
        ),
        settings.STRIPE_WEBHOOK_SECRET,
    )

    assert res.status_code == 200
    assert UserProfile.objects.get(user=user).cancel_at_period_end is True


@pytest.mark.django_db
def test_subscription_updated_with_cancel_at_period_end_true_is_persisted(settings, monkeypatch):
    _enable_stripe_billing(settings, monkeypatch)
    period_end = int(time.time()) + 3600
    user = _user_with_customer("cape-updated-true", "cus_cape_updated_true")
    client = APIClient()

    res = _post_signed(
        client,
        _payload(
            "customer.subscription.updated",
            _subscription_obj(
                customer="cus_cape_updated_true", cancel_at_period_end=True, period_end=period_end
            ),
        ),
        settings.STRIPE_WEBHOOK_SECRET,
    )

    assert res.status_code == 200
    assert UserProfile.objects.get(user=user).cancel_at_period_end is True


@pytest.mark.django_db
def test_subscription_updated_with_cancel_at_period_end_false_clears_the_flag(settings, monkeypatch):
    """解約予約を取り消した（Portal で「更新を再開」した）場合、False へ戻ること。"""
    _enable_stripe_billing(settings, monkeypatch)
    period_end = int(time.time()) + 3600
    user = _user_with_customer(
        "cape-updated-false", "cus_cape_updated_false", cancel_at_period_end=True
    )
    client = APIClient()

    res = _post_signed(
        client,
        _payload(
            "customer.subscription.updated",
            _subscription_obj(
                customer="cus_cape_updated_false",
                cancel_at_period_end=False,
                period_end=period_end,
            ),
        ),
        settings.STRIPE_WEBHOOK_SECRET,
    )

    assert res.status_code == 200
    assert UserProfile.objects.get(user=user).cancel_at_period_end is False


@pytest.mark.django_db
def test_subscription_deleted_resets_cancel_at_period_end(settings, monkeypatch):
    _enable_stripe_billing(settings, monkeypatch)
    period_end = int(time.time()) + 3600
    user = _user_with_customer(
        "cape-deleted", "cus_cape_deleted", cancel_at_period_end=True, subscription_status="active"
    )
    client = APIClient()

    res = _post_signed(
        client,
        _payload(
            "customer.subscription.deleted",
            _subscription_obj(
                customer="cus_cape_deleted",
                cancel_at_period_end=True,
                period_end=period_end,
                status="canceled",
            ),
        ),
        settings.STRIPE_WEBHOOK_SECRET,
    )

    assert res.status_code == 200
    profile = UserProfile.objects.get(user=user)
    assert profile.cancel_at_period_end is False
    assert profile.subscription_status == "canceled"
    assert profile.current_period_end is None


@pytest.mark.django_db
def test_subscription_updated_without_the_key_keeps_the_stored_value(settings, monkeypatch):
    """
    payload に cancel_at_period_end が無い場合は、Stripe が何も言っていないので
    既存値を上書きしない（勝手に False へ倒さない）。
    """
    _enable_stripe_billing(settings, monkeypatch)
    period_end = int(time.time()) + 3600
    user = _user_with_customer(
        "cape-updated-absent", "cus_cape_absent", cancel_at_period_end=True
    )
    client = APIClient()

    res = _post_signed(
        client,
        _payload(
            "customer.subscription.updated",
            _subscription_obj(
                customer="cus_cape_absent", cancel_at_period_end=None, period_end=period_end
            ),
        ),
        settings.STRIPE_WEBHOOK_SECRET,
    )

    assert res.status_code == 200
    assert UserProfile.objects.get(user=user).cancel_at_period_end is True


@pytest.mark.django_db
def test_billing_status_returns_cancel_at_period_end_from_db(settings, monkeypatch):
    """Billing status は DB の値をそのまま返す（Stripe API は叩かない）。"""
    from django.utils import timezone
    from datetime import timedelta

    _enable_stripe_billing(settings, monkeypatch)
    user = _user_with_customer(
        "cape-status",
        "cus_cape_status",
        subscription_status="active",
        current_period_end=timezone.now() + timedelta(days=10),
        cancel_at_period_end=True,
    )
    client = APIClient()
    client.force_authenticate(user=user)

    res = client.get(STATUS_URL)

    assert res.status_code == 200
    assert res.json()["cancel_at_period_end"] is True


@pytest.mark.django_db
def test_billing_status_keeps_premium_while_cancel_is_scheduled(settings, monkeypatch):
    """
    最重要契約: cancel_at_period_end=true だけを理由に Free へ落とさない。

    status=active / cancel_at_period_end=true / current_period_end が未来 なら
    期間終了までは Premium を維持する。
    """
    from django.utils import timezone
    from datetime import timedelta

    _enable_stripe_billing(settings, monkeypatch)
    user = _user_with_customer(
        "cape-still-premium",
        "cus_cape_still_premium",
        subscription_status="active",
        current_period_end=timezone.now() + timedelta(days=10),
        cancel_at_period_end=True,
    )
    client = APIClient()
    client.force_authenticate(user=user)

    res = client.get(STATUS_URL)

    assert res.status_code == 200
    data = res.json()
    assert data["plan"] == "premium"
    assert data["is_active"] is True
    assert data["cancel_at_period_end"] is True
    assert data["current_period_end"] is not None

    # 利用制限側（chat の無料回数分岐）も Premium 扱いのままであること
    from temples.services.billing_state import is_premium_for_user

    assert is_premium_for_user(user) is True


@pytest.mark.django_db
def test_billing_status_goes_free_after_the_period_ends(settings, monkeypatch):
    """
    解約予約の期間が過ぎたら Premium は終了する
    （cancel_at_period_end は判定に使わないので、期限だけで Free になる）。
    """
    from django.utils import timezone
    from datetime import timedelta

    _enable_stripe_billing(settings, monkeypatch)
    user = _user_with_customer(
        "cape-expired",
        "cus_cape_expired",
        subscription_status="active",
        current_period_end=timezone.now() - timedelta(days=1),
        cancel_at_period_end=True,
    )
    client = APIClient()
    client.force_authenticate(user=user)

    res = client.get(STATUS_URL)

    assert res.status_code == 200
    data = res.json()
    assert data["plan"] == "free"
    assert data["is_active"] is False


@pytest.mark.django_db
def test_portal_cancel_then_resume_round_trip(settings, monkeypatch):
    """
    Customer Portal での「解約予約 → 取り消し」往復が Billing status に反映されること。
    """
    _enable_stripe_billing(settings, monkeypatch)
    period_end = int(time.time()) + 86400
    user = _user_with_customer("cape-round-trip", "cus_cape_round_trip")
    webhook_client = APIClient()
    api_client = APIClient()
    api_client.force_authenticate(user=user)

    _post_signed(
        webhook_client,
        _payload(
            "customer.subscription.updated",
            _subscription_obj(
                customer="cus_cape_round_trip", cancel_at_period_end=True, period_end=period_end
            ),
        ),
        settings.STRIPE_WEBHOOK_SECRET,
    )
    cancelled = api_client.get(STATUS_URL).json()
    assert cancelled["plan"] == "premium"
    assert cancelled["cancel_at_period_end"] is True

    _post_signed(
        webhook_client,
        _payload(
            "customer.subscription.updated",
            _subscription_obj(
                customer="cus_cape_round_trip", cancel_at_period_end=False, period_end=period_end
            ),
        ),
        settings.STRIPE_WEBHOOK_SECRET,
    )
    resumed = api_client.get(STATUS_URL).json()
    assert resumed["plan"] == "premium"
    assert resumed["cancel_at_period_end"] is False
