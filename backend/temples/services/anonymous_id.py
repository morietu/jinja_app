from __future__ import annotations

import logging
import uuid
from typing import Optional
from urllib.parse import unquote

from django.conf import settings
from django.core import signing
from django.http import HttpRequest, HttpResponse


log = logging.getLogger(__name__)

ANONYMOUS_ID_COOKIE_NAME = "concierge_anon_id"
ANONYMOUS_ID_SALT = "temples.concierge.anonymous_id"
ANONYMOUS_ID_MAX_AGE = 60 * 60 * 24 * 90  # 90日


def _sign_anon_id(raw_id: str) -> str:
    return signing.dumps(raw_id, salt=ANONYMOUS_ID_SALT)


def _unsign_anon_id(signed_value: str) -> Optional[str]:
    try:
        value = signing.loads(signed_value, salt=ANONYMOUS_ID_SALT, max_age=None)
        log.info("[anon_id] signing.loads ok value=%r", value)
    except signing.BadSignature:
        log.warning("[anon_id] BadSignature signed_value=%r", signed_value)
        return None
    except signing.SignatureExpired:
        log.warning("[anon_id] SignatureExpired signed_value=%r", signed_value)
        return None

    if not isinstance(value, str) or not value:
        log.warning("[anon_id] invalid unsigned value=%r", value)
        return None
    return value


def get_anonymous_id(request: HttpRequest) -> Optional[str]:
    signed_value = request.COOKIES.get(ANONYMOUS_ID_COOKIE_NAME)
    log.info("[anon_id] get cookie raw=%r len=%s", signed_value, len(signed_value) if signed_value else None)
    if not signed_value:
        return None

    normalized_value = unquote(signed_value)
    log.info(
        "[anon_id] normalized cookie=%r len=%s has_pct3A=%s colon_count=%s",
        normalized_value,
        len(normalized_value),
        "%3A" in signed_value,
        normalized_value.count(":"),
    )

    value = _unsign_anon_id(normalized_value)
    log.info("[anon_id] unsign result=%r", value)
    return value


def issue_anonymous_id() -> str:
    return str(uuid.uuid4())


def get_or_create_anonymous_id(request: HttpRequest) -> str:
    existing = get_anonymous_id(request)
    if existing:
        return existing
    return issue_anonymous_id()


def build_anonymous_cookie_value(anon_id: str) -> str:
    value = _sign_anon_id(anon_id)
    log.info("[anon_id] build cookie value=%r len=%s", value, len(value))
    return value


def attach_anonymous_cookie(response: HttpResponse, anon_id: str) -> None:
    is_prod_like = not settings.DEBUG

    response.set_cookie(
        key=ANONYMOUS_ID_COOKIE_NAME,
        value=build_anonymous_cookie_value(anon_id),
        max_age=ANONYMOUS_ID_MAX_AGE,
        httponly=True,
        samesite="None" if is_prod_like else "Lax",
        secure=True if is_prod_like else False,
        path="/",
    )
