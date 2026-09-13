# backend/temples/services/billing_portal.py
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from django.conf import settings

from temples.services.billing_state import provider
from users.models import UserProfile


class BillingPortalError(RuntimeError):
    """Stripe Customer Portal session 作成の失敗を表す基底例外。"""


class BillingPortalNotConfigured(BillingPortalError):
    """Stripe provider / secret が未設定（= 503 相当）。"""


class BillingPortalCustomerMissing(BillingPortalError):
    """当該ユーザーに Stripe customer が紐づいていない（= 409 相当）。"""


class BillingPortalUnavailable(BillingPortalError):
    """Stripe 側の失敗・不正レスポンス（= 503 相当）。"""


@dataclass(frozen=True)
class PortalSession:
    portal_url: str


def _field(obj: Any, name: str) -> str:
    value = getattr(obj, name, None)
    if value is None and isinstance(obj, dict):
        value = obj.get(name)
    return str(value or "")


def create_portal_session(*, user, return_url: str) -> PortalSession:
    """
    Stripe Customer Portal の session を作り、遷移先 URL だけを返す。

    方針:
    - 解約/更新の UI と状態遷移は Stripe Customer Portal に委譲する
      （自前の cancel API / 解約状態は持たない）
    - 契約状態の正本は Backend（UserProfile）であり、
      Portal 操作の結果は既存の customer.subscription.* webhook が反映する
    - Stripe の secret / 内部エラー文言は呼び出し側へ返さない
    """
    if provider() != "stripe":
        raise BillingPortalNotConfigured("stripe billing provider is not enabled")

    secret_key = (getattr(settings, "STRIPE_SECRET_KEY", "") or "").strip()
    if not secret_key:
        raise BillingPortalNotConfigured("stripe secret key is not configured")

    try:
        import stripe  # type: ignore
    except Exception as exc:  # pragma: no cover - depends on optional deployment package
        raise BillingPortalNotConfigured("stripe sdk is not installed") from exc

    profile = UserProfile.objects.filter(user=user).first()
    customer_id = (getattr(profile, "stripe_customer_id", "") or "").strip()
    if not customer_id:
        raise BillingPortalCustomerMissing("stripe customer is not linked to this user")

    stripe.api_key = secret_key

    try:
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=return_url,
        )
    except Exception as exc:
        # Stripe の例外メッセージは呼び出し側へ伝播させない
        raise BillingPortalUnavailable("failed to create stripe billing portal session") from exc

    portal_url = _field(session, "url")
    if not portal_url:
        raise BillingPortalUnavailable("stripe billing portal session response is invalid")

    return PortalSession(portal_url=portal_url)
