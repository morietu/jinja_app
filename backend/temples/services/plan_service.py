# temples/services/plan_service.py
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from temples.services.anonymous_id import (
    ANONYMOUS_ID_COOKIE_NAME,
    get_or_create_anonymous_id,
)
from temples.services.billing_state import is_premium_for_user


@dataclass(frozen=True)
class PlanContext:
    plan: str  # anonymous | free | premium
    user_id: Optional[int]
    anon_id: Optional[str]
    is_authenticated: bool
    should_set_anon_cookie: bool = False


def resolve_plan_context(request) -> PlanContext:
    user = getattr(request, "user", None)

    if user and user.is_authenticated:
        if is_premium_for_user(user):
            return PlanContext(
                plan="premium",
                user_id=user.id,
                anon_id=None,
                is_authenticated=True,
            )
        return PlanContext(
            plan="free",
            user_id=user.id,
            anon_id=None,
            is_authenticated=True,
        )

    existing_cookie = request.COOKIES.get(ANONYMOUS_ID_COOKIE_NAME)
    anon_id = get_or_create_anonymous_id(request)

    return PlanContext(
        plan="anonymous",
        user_id=None,
        anon_id=anon_id,
        is_authenticated=False,
        should_set_anon_cookie=not bool(existing_cookie),
    )
