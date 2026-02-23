from __future__ import annotations

import logging
from typing import Any, Optional

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from datetime import datetime, timezone as dt_timezone

from users.models import UserProfile

log = logging.getLogger(__name__)
User = get_user_model()


def _to_dt_from_unix(ts: Any) -> Optional[datetime]:
    try:
        if ts is None:
            return None
        # Stripeはunix秒。DBはUSE_TZ=True前提で aware にする
        return datetime.fromtimestamp(int(ts), tz=dt_timezone.utc)
    except Exception:
        log.exception("[stripe] _to_dt_from_unix failed ts=%r type=%s", ts, type(ts).__name__)
        return None


def _get_event_type(event: dict[str, Any]) -> str:
    t = event.get("type")
    return t if isinstance(t, str) else ""


def _get_object(event: dict[str, Any]) -> dict[str, Any]:
    obj = (event.get("data") or {}).get("object") or {}
    return obj if isinstance(obj, dict) else {}


def _extract_user_id_from_checkout_session(obj: dict[str, Any]) -> Optional[int]:
    # 1) metadata.user_id
    md = obj.get("metadata")
    if isinstance(md, dict):
        v = md.get("user_id")
        try:
            if isinstance(v, str) and v.strip():
                return int(v.strip())
        except Exception:
            pass

    # 2) client_reference_id
    v = obj.get("client_reference_id")
    try:
        if isinstance(v, str) and v.strip():
            return int(v.strip())
    except Exception:
        pass

    return None


def _is_trueish(v: Any) -> bool:
    if v is True:
        return True
    if isinstance(v, (int, float)):
        return v == 1
    if isinstance(v, str):
        return v.strip().lower() in {"1", "true", "yes", "on"}
    return False


def _extract_current_period_end(obj: dict[str, Any]) -> Optional[datetime]:
    """
    Stripe subscription の period end は payload によって場所がブレる。
    優先順:
      1) subscription.current_period_end
      2) items.data[0].current_period_end
      3) cancel_at (cancel_at_period_end=true のときは「今期末」と一致しがち)
    """
    # 1) top-level
    dt = _to_dt_from_unix(obj.get("current_period_end"))
    if dt is not None:
        return dt

    # 2) items[0]
    try:
        items = (obj.get("items") or {}).get("data") or []
        if isinstance(items, list) and items:
            dt = _to_dt_from_unix((items[0] or {}).get("current_period_end"))
            if dt is not None:
                return dt
    except Exception:
        pass

    # 3) cancel_at fallback
    if _is_trueish(obj.get("cancel_at_period_end")):
        dt = _to_dt_from_unix(obj.get("cancel_at"))
        if dt is not None:
            return dt

    return None


def _fetch_subscription_period_end_from_api(sub_id: str) -> Optional[datetime]:
    """
    Webhook payload が薄い/展開されないケースに備えて、Stripe API から subscription を取得して period_end を確定させる。
    """
    try:
        import stripe  # type: ignore

        sk = getattr(settings, "STRIPE_SECRET_KEY", "") or ""
        if not sk.strip():
            log.info("[stripe] api fallback skipped: STRIPE_SECRET_KEY missing")
            return None

        stripe.api_key = sk.strip()

        sub = stripe.Subscription.retrieve(sub_id, expand=["items.data"])
        sub_dict = (
            sub.to_dict_recursive() if hasattr(sub, "to_dict_recursive") else dict(sub)
        )

        # 1) current_period_end
        dt = _to_dt_from_unix(sub_dict.get("current_period_end"))
        if dt is not None:
            return dt

        # 2) items.data[0].current_period_end
        try:
            items = (sub_dict.get("items") or {}).get("data") or []
            if items:
                dt = _to_dt_from_unix((items[0] or {}).get("current_period_end"))
                if dt is not None:
                    return dt
        except Exception:
            pass

        # 3) cancel_at fallback
        if _is_trueish(sub_dict.get("cancel_at_period_end")):
            dt = _to_dt_from_unix(sub_dict.get("cancel_at"))
            if dt is not None:
                return dt

        return None
    except Exception:
        log.exception("[stripe] subscription retrieve failed sub=%r", sub_id)
        return None


@transaction.atomic
def apply_stripe_event(*, event: dict[str, Any]) -> None:
    """
    Stripe event(dict) を受けて UserProfile を更新する。
    """
    etype = _get_event_type(event)
    obj = _get_object(event)
    if not etype or not obj:
        return

    if etype == "checkout.session.completed":
        _apply_checkout_session_completed(obj)
        return

    if etype in {
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
    }:
        _apply_subscription_object(obj, etype=etype)
        return

    return


def _apply_checkout_session_completed(obj: dict[str, Any]) -> None:
    """
    checkout.session.completed:
    - customer_id を profile に保存する「入口」
    - subscription_id も取れたら一緒に保存
    """
    customer_id = obj.get("customer")
    if not isinstance(customer_id, str) or not customer_id.strip():
        return

    user_id = _extract_user_id_from_checkout_session(obj)
    if user_id is None:
        return

    user = User.objects.filter(id=user_id).first()
    if user is None:
        return

    profile, _ = UserProfile.objects.select_for_update().get_or_create(user=user)

    # 事故防止: 既に埋まってるなら上書きしない（必要なら方針変更）
    if not (profile.stripe_customer_id or "").strip():
        profile.stripe_customer_id = customer_id.strip()

    sub_id = obj.get("subscription")
    if isinstance(sub_id, str) and sub_id.strip():
        profile.stripe_subscription_id = sub_id.strip()

    profile.save(
        update_fields=[
            "stripe_customer_id",
            "stripe_subscription_id",
            "updated_at",
        ]
    )


def _apply_subscription_object(obj: dict[str, Any], *, etype: str) -> None:
    """
    customer.subscription.*:
    - customer_id で profile を引いて status/period_end/price_id を反映
    """
    log.info(
        "[stripe] _apply_subscription_object HIT etype=%s sub=%r customer=%r",
        etype,
        obj.get("id"),
        obj.get("customer"),
    )

    customer_id = obj.get("customer")
    if not isinstance(customer_id, str) or not customer_id.strip():
        return

    profile = (
        UserProfile.objects.select_for_update()
        .filter(stripe_customer_id=customer_id.strip())
        .first()
    )
    if profile is None:
        # 入口（checkout）で customer_id 保存ができてないとここに来る
        log.info("[stripe] profile not found for customer=%r", customer_id)
        return

    update_fields: list[str] = ["updated_at"]

    # subscription ID
    sub_id = obj.get("id")
    if isinstance(sub_id, str) and sub_id.strip():
        profile.stripe_subscription_id = sub_id.strip()
        update_fields.append("stripe_subscription_id")

    # price id (items.data[0].price.id)
    price_id: Optional[str] = None
    try:
        items = obj.get("items") or {}
        items_data = items.get("data") or []
        if isinstance(items_data, list) and items_data:
            price = (items_data[0] or {}).get("price") or {}
            pid = price.get("id")
            if isinstance(pid, str) and pid.strip():
                price_id = pid.strip()
    except Exception:
        price_id = None

    if price_id:
        profile.stripe_price_id = price_id
        update_fields.append("stripe_price_id")

    # status
    status = obj.get("status")
    if isinstance(status, str) and status.strip():
        profile.subscription_status = status.strip()
        update_fields.append("subscription_status")

    # ---- 観測ログ（payloadの形を確定） ----
    raw_cpe = obj.get("current_period_end")
    raw_cancel_at = obj.get("cancel_at")
    raw_cape = obj.get("cancel_at_period_end")
    items_container = obj.get("items")

    item0_cpe = None
    try:
        if isinstance(items_container, dict):
            data0 = ((items_container.get("data") or [None])[0])
            if isinstance(data0, dict):
                item0_cpe = data0.get("current_period_end")
    except Exception:
        pass

    log.info(
        "[stripe] raw types cpe=%s cancel_at=%s cape=%s items=%s item0_cpe=%s",
        type(raw_cpe).__name__,
        type(raw_cancel_at).__name__,
        type(raw_cape).__name__,
        type(items_container).__name__,
        type(item0_cpe).__name__,
    )
    log.info(
        "[stripe] raw values cpe=%r cancel_at=%r cape=%r item0_cpe=%r",
        raw_cpe,
        raw_cancel_at,
        raw_cape,
        item0_cpe,
    )

    # ---- 抽出 + fallback ----
    period_end = _extract_current_period_end(obj)

    if period_end is None and isinstance(sub_id, str) and sub_id.strip():
        period_end = _fetch_subscription_period_end_from_api(sub_id.strip())
        log.info("[stripe] api fallback sub=%r period_end=%r", sub_id, period_end)

    log.info(
        "[stripe] extracted period_end=%r sub=%r customer=%r status=%r",
        period_end,
        obj.get("id"),
        obj.get("customer"),
        obj.get("status"),
    )

    if period_end is not None:
        profile.current_period_end = period_end
        update_fields.append("current_period_end")

    profile.save(update_fields=sorted(set(update_fields)))


def apply_stripe_subscription_event(*, event: dict[str, Any]) -> None:
    """互換エイリアス（過去コード向け）"""
    apply_stripe_event(event=event)
