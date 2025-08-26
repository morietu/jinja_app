from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from temples.api.views import (
    ShrineViewSet,
    GoriyakuTagViewSet,
    FavoriteToggleView,
    UserFavoriteListView,
    UserVisitListView,
    RankingAPIView,
    VisitCreateView,
    RouteView,
)

app_name = "temples"

router = DefaultRouter()
router.register(r"shrines", ShrineViewSet, basename="shrines")
router.register(r"goriyaku-tags", GoriyakuTagViewSet, basename="goriyaku-tags")

urlpatterns = [
    path("", include(router.urls)),
    path("shrines/<int:shrine_id>/favorite/", FavoriteToggleView.as_view(), name="favorite_toggle"),
    path("shrines/<int:shrine_id>/route/", RouteView.as_view(), name="shrine_route"),
    path("shrines/<int:shrine_id>/visit/", VisitCreateView.as_view(), name="visit_create"),
    path("token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("ranking/", RankingAPIView.as_view(), name="ranking"),
    path("visits/", UserVisitListView.as_view(), name="visit-list"),
    path("favorites/", UserFavoriteListView.as_view(), name="favorite-list"),
]
