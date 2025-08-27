# backend/temples/api/views/__init__.py
from .shrine import ShrineViewSet, GoriyakuTagViewSet
from .visit import VisitCreateView, UserVisitListView
from .favorite import FavoriteToggleView, UserFavoriteListView
from .ranking import RankingAPIView
from .route import RouteView

__all__ = [
    "ShrineViewSet",
    "GoriyakuTagViewSet",
    "VisitCreateView",
    "UserVisitListView",
    "FavoriteToggleView",
    "UserFavoriteListView",
    "RankingAPIView",
    "RouteView",
]
