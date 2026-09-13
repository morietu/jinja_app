import sys
import types

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from users.models import UserProfile

PORTAL_URL = "/api/billings/portal/"
RETURN_URL = "http://localhost:3000/billing/manage"


def _enable_stripe_billing(settings, monkeypatch):
    monkeypatch.setenv("BILLING_PROVIDER", "stripe")
    settings.BILLING_PROVIDER = "stripe"
    settings.STRIPE_SECRET_KEY = "sk_test_dummy"


def _install_fake_stripe(monkeypatch, *, create):
    """
    stripe SDK を差し替えて billing_portal.Session.create の呼び出しを観測する。

    サービス側は関数内で `import stripe` するので、sys.modules 差し替えで足りる。
    """
    module = types.ModuleType("stripe")
    module.api_key = None
    module.billing_portal = types.SimpleNamespace(
        Session=types.SimpleNamespace(create=create)
    )
    monkeypatch.setitem(sys.modules, "stripe", module)
    return module


def _authed_client(*, username, customer_id=""):
    user = get_user_model().objects.create_user(username=username, password="pass1234")
    UserProfile.objects.update_or_create(
        user=user, defaults={"stripe_customer_id": customer_id}
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
def test_billing_portal_requires_auth(client: APIClient):
    res = client.post(PORTAL_URL, {"return_url": RETURN_URL}, format="json")

    assert res.status_code == 401


@pytest.mark.django_db
def test_billing_portal_returns_503_when_stripe_is_not_configured(settings, monkeypatch):
    monkeypatch.setenv("BILLING_PROVIDER", "stub")
    settings.STRIPE_SECRET_KEY = ""
    client = _authed_client(username="portal-unconfigured", customer_id="cus_any")

    res = client.post(PORTAL_URL, {"return_url": RETURN_URL}, format="json")

    assert res.status_code == 503


@pytest.mark.django_db
def test_billing_portal_returns_503_when_secret_key_is_missing(settings, monkeypatch):
    monkeypatch.setenv("BILLING_PROVIDER", "stripe")
    settings.BILLING_PROVIDER = "stripe"
    settings.STRIPE_SECRET_KEY = ""
    client = _authed_client(username="portal-no-secret", customer_id="cus_any")

    res = client.post(PORTAL_URL, {"return_url": RETURN_URL}, format="json")

    assert res.status_code == 503


@pytest.mark.django_db
def test_billing_portal_returns_409_without_stripe_customer_id(settings, monkeypatch):
    _enable_stripe_billing(settings, monkeypatch)

    def _never_called(**kwargs):  # pragma: no cover - 呼ばれたら失敗させたい
        raise AssertionError("stripe must not be called without a customer id")

    _install_fake_stripe(monkeypatch, create=_never_called)
    client = _authed_client(username="portal-no-customer", customer_id="")

    res = client.post(PORTAL_URL, {"return_url": RETURN_URL}, format="json")

    assert res.status_code == 409


@pytest.mark.django_db
def test_billing_portal_creates_session_and_returns_only_portal_url(settings, monkeypatch):
    _enable_stripe_billing(settings, monkeypatch)
    calls = []

    def _create(**kwargs):
        calls.append(kwargs)
        return {
            "id": "bps_123",
            "url": "https://billing.stripe.com/p/session/bps_123",
            "customer": "cus_portal",
            "livemode": False,
        }

    _install_fake_stripe(monkeypatch, create=_create)
    client = _authed_client(username="portal-active", customer_id="cus_portal")

    res = client.post(PORTAL_URL, {"return_url": RETURN_URL}, format="json")

    assert res.status_code == 200
    data = res.json()
    # レスポンス契約: portal_url のみ
    assert set(data.keys()) == {"portal_url"}
    assert data["portal_url"] == "https://billing.stripe.com/p/session/bps_123"


@pytest.mark.django_db
def test_billing_portal_passes_the_users_customer_id_to_stripe(settings, monkeypatch):
    _enable_stripe_billing(settings, monkeypatch)
    calls = []

    def _create(**kwargs):
        calls.append(kwargs)
        return {"url": "https://billing.stripe.com/p/session/bps_456"}

    _install_fake_stripe(monkeypatch, create=_create)
    # 別ユーザーの customer_id を掴まないことも同時に見る
    _authed_client(username="portal-other-user", customer_id="cus_other")
    client = _authed_client(username="portal-owner", customer_id="cus_owner")

    res = client.post(PORTAL_URL, {"return_url": RETURN_URL}, format="json")

    assert res.status_code == 200
    assert len(calls) == 1
    assert calls[0]["customer"] == "cus_owner"
    assert calls[0]["return_url"] == RETURN_URL


@pytest.mark.django_db
def test_billing_portal_returns_503_and_hides_stripe_error(settings, monkeypatch):
    _enable_stripe_billing(settings, monkeypatch)

    def _create(**kwargs):
        raise RuntimeError("sk_live_super_secret leaked into the stripe error")

    _install_fake_stripe(monkeypatch, create=_create)
    client = _authed_client(username="portal-stripe-error", customer_id="cus_boom")

    res = client.post(PORTAL_URL, {"return_url": RETURN_URL}, format="json")

    assert res.status_code == 503
    body = res.content.decode()
    assert "sk_live_super_secret" not in body
    assert "cus_boom" not in body


@pytest.mark.django_db
def test_billing_portal_returns_503_when_stripe_response_has_no_url(settings, monkeypatch):
    _enable_stripe_billing(settings, monkeypatch)

    def _create(**kwargs):
        return {"id": "bps_broken"}

    _install_fake_stripe(monkeypatch, create=_create)
    client = _authed_client(username="portal-bad-response", customer_id="cus_broken")

    res = client.post(PORTAL_URL, {"return_url": RETURN_URL}, format="json")

    assert res.status_code == 503
