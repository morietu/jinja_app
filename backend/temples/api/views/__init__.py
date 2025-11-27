# backend/temples/api/views/__init__.py
# -*- coding: utf-8 -*-

from .concierge import ConciergeChatView
from .shrine import NearestShrinesAPIView, RankingAPIView, ShrineViewSet
from .goshuin import PublicGoshuinViewSet, MyGoshuinViewSet  # ★ 追加

def chat(request, *args, **kwargs):
    ...
    return ConciergeChatView.as_view()(request, *args, **kwargs)

chat_legacy = chat

__all__ = [
    "ConciergeChatView",
    "chat",
    "chat_legacy",
    "NearestShrinesAPIView",
    "RankingAPIView",
    "ShrineViewSet",
    "PublicGoshuinViewSet",  # ★ 追加
    "MyGoshuinViewSet",      # ★ 追加
]
