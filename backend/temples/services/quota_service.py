# temples/services/quota_service.py
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from django.db import transaction
from django.conf import settings
from django.utils import timezone

from temples.models import FeatureUsage, ConciergeUsage

from temples.services.plan_service import PlanContext
from temples.services.quota_policy import get_feature_policy


@dataclass(frozen=True)
class QuotaStatus:
    allowed: bool
    feature: str
    plan: str
    used: int
    limit: Optional[int]
    remaining: Optional[int]
    unlimited: bool
    reason_code: Optional[str] = None

def get_used_count(plan_context: PlanContext, feature: str) -> int:
    current_count = 0

    if plan_context.plan == "anonymous":
        obj, _ = FeatureUsage.objects.get_or_create(
            scope="anonymous",
            anon_id=plan_context.anon_id,
            feature=feature,
            defaults={"count": 0},
        )
        current_count = obj.count
    else:
        obj, _ = FeatureUsage.objects.get_or_create(
            scope="user",
            user_id=plan_context.user_id,
            feature=feature,
            defaults={"count": 0},
        )
        current_count = obj.count

    # 旧 concierge 日次usageとの互換
    if feature == "concierge" and plan_context.user_id:
        legacy = (
            ConciergeUsage.objects.filter(
                user_id=plan_context.user_id,
                date=timezone.localdate(),
            )
            .values_list("count", flat=True)
            .first()
        )
        if legacy is not None:
            current_count = max(current_count, legacy)

    return current_count

def check_quota(plan_context: PlanContext, feature: str) -> QuotaStatus:
    policy = get_feature_policy(plan_context.plan, feature)

    if policy.get("unlimited"):
        return QuotaStatus(
            allowed=True,
            feature=feature,
            plan=plan_context.plan,
            used=0,
            limit=None,
            remaining=None,
            unlimited=True,
        )

    used = get_used_count(plan_context, feature)

    limit = policy["limit"]
    if feature == "concierge" and plan_context.plan == "free":
        limit = int(getattr(settings, "CONCIERGE_DAILY_FREE_LIMIT", limit))

    remaining = max(limit - used, 0)

    return QuotaStatus(
        allowed=used < limit,
        feature=feature,
        plan=plan_context.plan,
        used=used,
        limit=limit,
        remaining=remaining,
        unlimited=False,
        reason_code=None if used < limit else "LIMIT_REACHED",
    )

@transaction.atomic
def consume_quota(plan_context: PlanContext, feature: str, amount: int = 1) -> None:
    policy = get_feature_policy(plan_context.plan, feature)

    if policy.get("unlimited"):
        return

    if plan_context.plan == "anonymous":
        obj, _ = FeatureUsage.objects.select_for_update().get_or_create(
            scope="anonymous",
            anon_id=plan_context.anon_id,
            feature=feature,
            defaults={"count": 0},
        )
    else:
        obj, _ = FeatureUsage.objects.select_for_update().get_or_create(
            scope="user",
            user_id=plan_context.user_id,
            feature=feature,
            defaults={"count": 0},
        )

    obj.count += amount
    obj.save(update_fields=["count", "updated_at"])

    # 旧 concierge 日次usageとの互換書き込み
    if feature == "concierge" and plan_context.user_id:
        legacy_usage, _ = ConciergeUsage.objects.select_for_update().get_or_create(
            user_id=plan_context.user_id,
            date=timezone.localdate(),
            defaults={"count": 0},
        )

        legacy_limit = int(getattr(settings, "CONCIERGE_DAILY_FREE_LIMIT", 5))
        legacy_usage.count = min(legacy_usage.count + amount, legacy_limit)
        legacy_usage.save(update_fields=["count"])
