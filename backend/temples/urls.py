from django.urls import path, include
from .views import RankingAPIView
from rest_framework.routers import DefaultRouter
from temples.api.views import (
    ShrineViewSet,
    FavoriteToggleView,
    RouteView,
    VisitCreateView,
    GoriyakuTagViewSet,
)
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

app_name = "temples"

router = DefaultRouter()
router.register(r"shrines", ShrineViewSet, basename="shrines")
router.register(r"goriyaku-tags", GoriyakuTagViewSet, basename="goriyaku-tags")  # ← 追加

urlpatterns = [
    path("", include(router.urls)),
    path("shrines/<int:shrine_id>/favorite/", FavoriteToggleView.as_view(), name="favorite_toggle"),
    path("shrines/<int:shrine_id>/route/", RouteView.as_view(), name="shrine_route"),
    path("shrines/<int:shrine_id>/visit/", VisitCreateView.as_view(), name="visit_create"),
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("ranking/", RankingAPIView.as_view(), name="ranking"),
]
