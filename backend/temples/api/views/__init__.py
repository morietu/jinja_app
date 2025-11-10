from .concierge import ConciergeChatView, chat
from .ranking import RankingAPIView
from .shrine import NearestShrinesAPIView, ShrineViewSet

# 旧名の互換（レガシー）
chat_legacy = chat

__all__ = [
    "ConciergeChatView",
    "chat",
    "chat_legacy",
    "NearestShrinesAPIView",
    "RankingAPIView",
    "ShrineViewSet",
]
