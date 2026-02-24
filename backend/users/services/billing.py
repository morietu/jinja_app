# backend/users/services/billing.py
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from django.utils import timezone

ACTIVE_STATUSES = {"active", "trialing"}


@dataclass(frozen=True)
class BillingState:
    plan: str  # "free" | "premium"
    is_active: bool
    provider: str  # "stripe" | "stub" | "revenuecat" | "unknown"
    current_period_end: Optional[datetime]
    trial_ends_at: Optional[datetime]
    cancel_at_period_end: bool


def is_subscription_active(
    *,
    status: str | None,
    current_period_end: Optional[datetime],
    now: Optional[datetime] = None,
) -> bool:
    """
    status だけに頼ると事故るので、current_period_end があるなら期限優先。
    """
    s = (status or "").strip()
    now_ = now or timezone.now()

    if current_period_end is not None:
        # 期限が未来なら有効。statusが多少ズレても救う。
        return now_ < current_period_end

    return s in ACTIVE_STATUSES


def plan_from_profile(
    *,
    status: str | None,
    current_period_end: Optional[datetime],
    now: Optional[datetime] = None,
) -> str:
    return "premium" if is_subscription_active(status=status, current_period_end=current_period_end, now=now) else "free"
