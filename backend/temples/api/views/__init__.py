<<<<<<< HEAD
# -*- coding: utf-8 -*-
=======
# backend/temples/api/views/__init__.py
from .concierge import ConciergeChatView
from .shrine import NearestShrinesAPIView, RankingAPIView, ShrineViewSet
>>>>>>> 7242cd21 (fix(api): nearby endpoint via temples.api.urls; add re-exports + legacy shim)

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

<<<<<<< HEAD
__all__ = [
    "ConciergeChatView",
    "chat",
    "chat_legacy",
    "NearestShrinesAPIView",
    "RankingAPIView",
    "ShrineViewSet",
]
=======
__all__ = ["ConciergeChatView", "chat", "chat_legacy", "NearestShrinesAPIView", "RankingAPIView", "ShrineViewSet"]
>>>>>>> 7242cd21 (fix(api): nearby endpoint via temples.api.urls; add re-exports + legacy shim)
