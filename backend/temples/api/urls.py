# backend/temples/api/urls.py
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from temples.api.views import (
    FavoriteToggleView,
    RankingAPIView,
    RouteView,
    UserFavoriteListView,
    UserVisitListView,
    VisitCreateView,
)
from temples.api.views.search import search  # ← 追加
from temples.api.views.shrine import GoriyakuTagViewSet, ShrineViewSet

app_name = "temples"

router = DefaultRouter()
router.register(r"shrines", ShrineViewSet, basename="shrine")
router.register(r"goriyaku-tags", GoriyakuTagViewSet, basename="gori-tag")
# …他の register があればそのまま…

urlpatterns = [
    path("search/", search, name="search"),  # ← 追加
    path("ranking/", RankingAPIView.as_view()),
    path("route/", RouteView.as_view()),
    path("favorites/toggle/", FavoriteToggleView.as_view()),
    path("favorites/", UserFavoriteListView.as_view()),
    path("visits/", UserVisitListView.as_view()),
    path("visits/create/", VisitCreateView.as_view()),
    path("", include(router.urls)),
]
