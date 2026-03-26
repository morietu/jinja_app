from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Any

from django.db import transaction
from django.utils import timezone

from temples.models import ConciergeMessage, ConciergeThread


@dataclass
class ChatSaveResult:
    thread: ConciergeThread
    user_message: ConciergeMessage
    assistant_message: Optional[ConciergeMessage]


def _short_title(text: str, max_len: int = 40) -> str:
    text = (text or "").strip()
    if not text:
        return "相談スレッド"
    return text[:max_len]


@transaction.atomic
def append_chat(
    *,
    user=None,
    anonymous_id: Optional[str] = None,
    query: str,
    reply_text: Optional[str] = None,
    thread_id: Optional[int] = None,
    recommendations: Optional[list[dict[str, Any]]] = None,
    recommendations_v2: Optional[list[dict[str, Any]]] = None,
) -> ChatSaveResult:
    now = timezone.now()

    if user is None and not anonymous_id:
        raise ValueError("user または anonymous_id のどちらかが必要です")

    if thread_id is not None:
        if user is not None:
            thread = ConciergeThread.objects.select_for_update().get(
                id=thread_id,
                user=user,
            )
        else:
            thread = ConciergeThread.objects.select_for_update().get(
                id=thread_id,
                anonymous_id=anonymous_id,
            )
    else:
        thread = ConciergeThread.objects.create(
            user=user,
            anonymous_id=anonymous_id,
            title=_short_title(query),
            last_message_at=now,
            recommendations=recommendations,
            recommendations_v2=recommendations_v2,
        )
    user_msg = ConciergeMessage.objects.create(
        thread=thread,
        role="user",
        content=query,
        created_at=now,
    )

    assistant_msg: Optional[ConciergeMessage] = None
    if reply_text:
        assistant_msg = ConciergeMessage.objects.create(
            thread=thread,
            role="assistant",
            content=reply_text,
        )

    last_at = assistant_msg.created_at if assistant_msg else user_msg.created_at

    ConciergeThread.objects.filter(pk=thread.pk).update(
        last_message_at=last_at,
        recommendations=recommendations,
        recommendations_v2=recommendations_v2,
    )

    thread.refresh_from_db()
    return ChatSaveResult(thread=thread, user_message=user_msg, assistant_message=assistant_msg)
