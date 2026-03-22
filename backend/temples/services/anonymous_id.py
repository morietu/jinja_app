from __future__ import annotations

import uuid
from typing import Optional

from django.conf import settings
from django.core import signing
from django.http import HttpRequest, HttpResponse


ANONYMOUS_ID_COOKIE_NAME = "concierge_anon_id"
ANONYMOUS_ID_SALT = "temples.concierge.anonymous_id"
ANONYMOUS_ID_MAX_AGE = 60 * 60 * 24 * 90  # 90日


def _sign_anon_id(raw_id: str) -> str:
    return signing.dumps(raw_id, salt=ANONYMOUS_ID_SALT)


def _unsign_anon_id(signed_value: str) -> Optional[str]:
    try:
        value = signing.loads(signed_value, salt=ANONYMOUS_ID_SALT, max_age=None)
    except signing.BadSignature:
        return None
    except signing.SignatureExpired:
        return None

    if not isinstance(value, str) or not value:
        return None
    return value


def get_anonymous_id(request: HttpRequest) -> Optional[str]:
    signed_value = request.COOKIES.get(ANONYMOUS_ID_COOKIE_NAME)
    if not signed_value:
        return None
    return _unsign_anon_id(signed_value)


def issue_anonymous_id() -> str:
    return str(uuid.uuid4())


def get_or_create_anonymous_id(request: HttpRequest) -> str:
    existing = get_anonymous_id(request)
    if existing:
        return existing
    return issue_anonymous_id()


def build_anonymous_cookie_value(anon_id: str) -> str:
    return _sign_anon_id(anon_id)


def attach_anonymous_cookie(response: HttpResponse, anon_id: str) -> None:
    response.set_cookie(
        key=ANONYMOUS_ID_COOKIE_NAME,
        value=build_anonymous_cookie_value(anon_id),
        max_age=ANONYMOUS_ID_MAX_AGE,
        httponly=True,
        samesite="Lax",
        secure=not settings.DEBUG,
    )
