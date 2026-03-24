from __future__ import annotations

import logging

from dataclasses import dataclass
from typing import Optional

from django.db import transaction
from django.conf import settings
from django.utils import timezone

from temples.models import FeatureUsage, ConciergeUsage

from temples.services.plan_service import PlanContext
from temples.services.quota_policy import get_feature_policy

log = logging.getLogger(__name__)


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
    feature_obj = None

    if plan_context.plan == "anonymous":
        obj, created = FeatureUsage.objects.get_or_create(
            scope="anonymous",
            anon_id=plan_context.anon_id,
            feature=feature,
            defaults={"count": 0},
        )
        feature_obj = obj
        current_count = obj.count

        log.warning(
            "[quota/read][feature] created=%s scope=%s anon_id=%r user_id=%r feature=%s count=%r id=%r",
            created,
            obj.scope,
            getattr(obj, "anon_id", None),
            getattr(obj, "user_id", None),
            obj.feature,
            obj.count,
            getattr(obj, "id", None),
        )
    else:
        obj, created = FeatureUsage.objects.get_or_create(
            scope="user",
            user_id=plan_context.user_id,
            feature=feature,
            defaults={"count": 0},
        )
        feature_obj = obj
        current_count = obj.count

        log.warning(
            "[quota/read][feature] created=%s scope=%s anon_id=%r user_id=%r feature=%s count=%r id=%r",
            created,
            obj.scope,
            getattr(obj, "anon_id", None),
            getattr(obj, "user_id", None),
            obj.feature,
            obj.count,
            getattr(obj, "id", None),
        )

    legacy = None

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

    log.warning(
        "[quota/read][final] plan=%s feature=%s user_id=%r anon_id=%r feature_count=%r legacy_count=%r used=%r",
        plan_context.plan,
        feature,
        plan_context.user_id,
        plan_context.anon_id,
        getattr(feature_obj, "count", None),
        legacy,
        current_count,
    )

    return current_count


def check_quota(plan_context: PlanContext, feature: str) -> QuotaStatus:
    policy = get_feature_policy(plan_context.plan, feature)

    if policy.get("unlimited"):
        log.warning(
            "[quota/check] plan=%s feature=%s unlimited=1 user_id=%r anon_id=%r",
            plan_context.plan,
            feature,
            plan_context.user_id,
            plan_context.anon_id,
        )
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

    log.warning(
        "[quota/check] plan=%s feature=%s user_id=%r anon_id=%r used=%r limit=%r remaining=%r allowed=%s",
        plan_context.plan,
        feature,
        plan_context.user_id,
        plan_context.anon_id,
        used,
        limit,
        remaining,
        used < limit,
    )

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
        log.warning(
            "[quota/consume] skipped_unlimited=1 plan=%s feature=%s user_id=%r anon_id=%r",
            plan_context.plan,
            feature,
            plan_context.user_id,
            plan_context.anon_id,
        )
        return

    if plan_context.plan == "anonymous":
        obj, created = FeatureUsage.objects.select_for_update().get_or_create(
            scope="anonymous",
            anon_id=plan_context.anon_id,
            feature=feature,
            defaults={"count": 0},
        )
    else:
        obj, created = FeatureUsage.objects.select_for_update().get_or_create(
            scope="user",
            user_id=plan_context.user_id,
            feature=feature,
            defaults={"count": 0},
        )

    before_count = obj.count
    obj.count += amount
    obj.save(update_fields=["count", "updated_at"])
    obj.refresh_from_db()

    log.warning(
        "[quota/consume][feature] created=%s scope=%s anon_id=%r user_id=%r feature=%s before=%r after=%r id=%r",
        created,
        obj.scope,
        getattr(obj, "anon_id", None),
        getattr(obj, "user_id", None),
        obj.feature,
        before_count,
        obj.count,
        getattr(obj, "id", None),
    )

    # 旧 concierge 日次usageとの互換書き込み
    if feature == "concierge" and plan_context.user_id:
        legacy_usage, legacy_created = ConciergeUsage.objects.select_for_update().get_or_create(
            user_id=plan_context.user_id,
            date=timezone.localdate(),
            defaults={"count": 0},
        )

        legacy_before = legacy_usage.count
        legacy_limit = int(getattr(settings, "CONCIERGE_DAILY_FREE_LIMIT", 5))
        legacy_usage.count = min(legacy_usage.count + amount, legacy_limit)
        legacy_usage.save(update_fields=["count"])
        legacy_usage.refresh_from_db()

        log.warning(
            "[quota/consume][legacy] created=%s user_id=%r date=%s before=%r after=%r",
            legacy_created,
            plan_context.user_id,
            timezone.localdate(),
            legacy_before,
            legacy_usage.count,
        )
