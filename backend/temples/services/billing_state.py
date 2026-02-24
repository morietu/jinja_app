# backend/temples/services/billing_state.py
from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional

from django.utils import timezone as dj_timezone

from users.services.billing import is_subscription_active

PROVIDER_CHOICES = ("stub", "stripe", "revenuecat", "unknown")


@dataclass(frozen=True)
class BillingStatus:
    plan: str  # "free" | "premium"
    is_active: bool
    provider: str  # "stub" | "stripe" | "revenuecat" | "unknown"
    current_period_end: Optional[datetime]
    trial_ends_at: Optional[datetime]
    cancel_at_period_end: bool


def provider() -> str:
    p = (os.getenv("BILLING_PROVIDER", "stub") or "stub").strip().lower()
    return p if p in PROVIDER_CHOICES else "unknown"


def _billing_stub_env() -> tuple[str, str]:
    plan = (os.environ.get("BILLING_STUB_PLAN") or "free").strip().lower()
    active = (os.environ.get("BILLING_STUB_ACTIVE") or "0").strip().lower()
    return plan, active


def get_billing_status(*, user=None, now: Optional[datetime] = None) -> BillingStatus:
    now_ = now or dj_timezone.now()
    prov = provider()

    # ✅ stub運用なら、認証済みでも env を正とする（テスト/未導入の世界線）
    if prov == "stub":
        return _status_from_stub_env(now_=now_, prov=prov)

    # ---- stripe/revenuecat運用: 認証済みは DB(profile) を見る ----
    if user is not None and getattr(user, "is_authenticated", False):
        prof = getattr(user, "profile", None)
        status = getattr(prof, "subscription_status", None) if prof else None
        cpe = getattr(prof, "current_period_end", None) if prof else None

        active = is_subscription_active(status=status, current_period_end=cpe, now=now_)
        plan = "premium" if active else "free"

        return BillingStatus(
            plan=plan,
            is_active=active,
            provider=prov,
            current_period_end=(cpe if active else None),
            trial_ends_at=None,
            cancel_at_period_end=False,
        )

    # ---- anonymous: stub env (stripe運用でも未認証はstubで良いならここ。嫌ならfree固定でもOK) ----
    return _status_from_stub_env(now_=now_, prov=prov)


def _status_from_stub_env(*, now_: datetime, prov: str) -> BillingStatus:
    plan_env, active_env = _billing_stub_env()
    active = active_env in {"1", "true", "yes", "y", "on"}
    plan = "premium" if plan_env == "premium" else "free"

    if plan == "premium" and os.getenv("BILLING_STUB_ACTIVE") is None:
        active = True

    cpe = (now_ + timedelta(days=30)) if active else None

    prov_out = prov
    if plan == "premium" and prov_out == "stub":
        prov_out = "stripe"  # 互換のため寄せたいなら。嫌なら prov_out="stub" で統一でもOK。

    cancel_at_period_end = (os.getenv("BILLING_STUB_CANCEL_AT_PERIOD_END", "0") or "0").strip().lower() in {
        "1", "true", "yes", "y", "on",
    }

    return BillingStatus(
        plan=plan,
        is_active=bool(active),
        provider=prov_out,
        current_period_end=cpe,
        trial_ends_at=None,
        cancel_at_period_end=bool(cancel_at_period_end),
    )

    # ---- anonymous: stub env ----
    plan_env, active_env = _billing_stub_env()
    active = active_env in {"1", "true", "yes", "y", "on"}
    plan = "premium" if plan_env == "premium" else "free"

    # 互換: premium で active 未指定なら active 扱い
    if plan == "premium" and os.getenv("BILLING_STUB_ACTIVE") is None:
        active = True

    # contract: active のときは current_period_end が入る想定
    cpe = (now_ + timedelta(days=30)) if active else None

    # 既存 view と同じノリ: stub/premium のとき provider を stripe 扱いに寄せる
    prov_out = prov
    if plan == "premium" and prov_out == "stub":
        prov_out = "stripe"

    cancel_at_period_end = (os.getenv("BILLING_STUB_CANCEL_AT_PERIOD_END", "0") or "0").strip().lower() in {
        "1",
        "true",
        "yes",
        "y",
        "on",
    }

    return BillingStatus(
        plan=plan,
        is_active=bool(active),
        provider=prov_out,
        current_period_end=cpe,
        trial_ends_at=None,
        cancel_at_period_end=bool(cancel_at_period_end),
    )


def is_premium_for_request(request) -> bool:
    user = getattr(request, "user", None)
    return is_premium_for_user(user)


def is_premium_for_user(user) -> bool:
    st = get_billing_status(user=user)
    return st.plan == "premium" and st.is_active


def recommend_limit_for_user(user) -> int:
    return 6 if is_premium_for_user(user) else 3
