# 主要ビューの公開
from .concierge import ConciergeChatView
from .shrine import NearestShrinesAPIView, RankingAPIView, ShrineViewSet

import warnings

# as_view() は一度だけ作成（微最適化）
_concierge_view = ConciergeChatView.as_view()

def chat(request, *args, **kwargs):
    """
    Legacy FBV shim:
    以前は `from temples.api.views.concierge import chat` だったが、
    いまは CBV のみなので、ここで関数ビューとしてラップして互換提供する。
    """
    warnings.warn(
        "temples.api.views.chat は非推奨です。ConciergeChatView を直接利用してください。",
        DeprecationWarning,
        stacklevel=2,
    )
    return _concierge_view(request, *args, **kwargs)

# レガシー名
chat_legacy = chat

__all__ = [
    "ConciergeChatView",
    "chat",
    "chat_legacy",
    "NearestShrinesAPIView",
    "RankingAPIView",
    "ShrineViewSet",
]
