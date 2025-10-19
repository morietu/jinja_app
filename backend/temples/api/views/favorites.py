# 互換: 旧 import パスから Aパス(temples.api_views)へ委譲
from temples.api_views import FavoriteViewSet  # re-export

__all__ = ["FavoriteViewSet"]
