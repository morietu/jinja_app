# backend/temples/api/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from temples.api.views.concierge import ConciergeAPIView
from temples.api.views.concierge import ConciergeAPIView, ConciergeHistoryListView


from .views import (
    ShrineViewSet,
    GoriyakuTagViewSet,
    FavoriteToggleView,
    UserFavoriteListView,
    RouteView,
    VisitCreateView,
    UserVisitListView,
    RankingAPIView,
)

router = DefaultRouter()
router.register(r"shrines", ShrineViewSet, basename="shrines")
router.register(r"goriyaku-tags", GoriyakuTagViewSet, basename="goriyaku-tags")

urlpatterns = [
    path("", include(router.urls)),
    path("shrines/<int:shrine_id>/favorite/", FavoriteToggleView.as_view(), name="favorite_toggle"),
    path("shrines/<int:shrine_id>/visit/", VisitCreateView.as_view(), name="visit_create"),
    path("favorites/", UserFavoriteListView.as_view(), name="favorite_list"),
    path("visits/", UserVisitListView.as_view(), name="visit_list"),
    path("ranking/", RankingAPIView.as_view(), name="ranking"),
    path("route/", RouteView.as_view(), name="route"),
    path("concierge/", ConciergeAPIView.as_view(), name="concierge"),
    path("concierge/history/", ConciergeHistoryListView.as_view(), name="concierge_history"),
]


