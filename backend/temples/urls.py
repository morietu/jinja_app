from django.urls import path, include
from rest_framework.routers import DefaultRouter
from temples.api.views import (
    ShrineViewSet, GoriyakuTagViewSet,
    VisitCreateView, UserVisitListView,
    FavoriteToggleView, UserFavoriteListView,
    RankingAPIView
)

router = DefaultRouter()
router.register(r"shrines", ShrineViewSet, basename="shrines")
router.register(r"goriyaku-tags", GoriyakuTagViewSet, basename="goriyaku-tags")

urlpatterns = [
    path("", include(router.urls)),
    path("shrines/<int:shrine_id>/visit/", VisitCreateView.as_view(), name="visit_create"),
    path("shrines/<int:shrine_id>/favorite/", FavoriteToggleView.as_view(), name="favorite_toggle"),
    path("visits/", UserVisitListView.as_view(), name="visit-list"),
    path("favorites/", UserFavoriteListView.as_view(), name="favorite-list"),
    path("ranking/", RankingAPIView.as_view(), name="ranking"),
]
