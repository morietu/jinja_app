# backend/temples/services/concierge_history.py
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

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


# backend/temples/services/concierge_history.py

@transaction.atomic
def append_chat(*, user, query: str, reply_text: Optional[str] = None, thread_id: Optional[int] = None) -> ChatSaveResult:
    now = timezone.now()

    # 1) thread 取得 or 新規作成
    if thread_id is not None:
        thread = ConciergeThread.objects.select_for_update().get(id=thread_id, user=user)
    else:
        thread = ConciergeThread.objects.create(
            user=user,
            title=_short_title(query),
            last_message_at=now,  # ✅ これは存在する
            # main_shrine / tags は必要なら後で
        )

    # 2) user メッセージ
    user_msg = ConciergeMessage.objects.create(
        thread=thread,
        role="user",
        content=query,
        created_at=now,
    )

    # 3) assistant メッセージ（あれば）
    assistant_msg: Optional[ConciergeMessage] = None
    if reply_text:
        assistant_msg = ConciergeMessage.objects.create(
            thread=thread,
            role="assistant",
            content=reply_text,
        )

    # 4) thread メタ更新（存在する項目だけ）
    # last_message_at は ConciergeMessage.save() でも更新されるけど、ここで確実に更新してOK
    last_at = assistant_msg.created_at if assistant_msg else user_msg.created_at
    ConciergeThread.objects.filter(pk=thread.pk).update(last_message_at=last_at)

    return ChatSaveResult(thread=thread, user_message=user_msg, assistant_message=assistant_msg)
