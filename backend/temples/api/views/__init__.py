# -*- coding: utf-8 -*-

# 主要ビューの公開
from .concierge import ConciergeChatView
from .shrine import NearestShrinesAPIView, RankingAPIView, ShrineViewSet


def chat(request, *args, **kwargs):
    """
    Legacy FBV shim:
    以前は `from temples.api.views.concierge import chat` だったが、
    いまは CBV のみなので、ここで関数ビューとしてラップして互換提供する。
    """
    return ConciergeChatView.as_view()(request, *args, **kwargs)


# レガシー名を残すなら（任意）
chat_legacy = chat

__all__ = [
    "ConciergeChatView",
    "chat",
    "chat_legacy",
    "NearestShrinesAPIView",
    "RankingAPIView",
    "ShrineViewSet",
]
