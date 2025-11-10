# backend/temples/api/views/__init__.py
from .concierge import ConciergeChatView
from .shrine import NearestShrinesAPIView, RankingAPIView, ShrineViewSet

# 既存URLの互換参照（関数ビューとして公開）
chat = ConciergeChatView.as_view()
chat_legacy = chat

__all__ = ["ConciergeChatView", "chat", "chat_legacy", "NearestShrinesAPIView", "RankingAPIView", "ShrineViewSet"]
