# backend/temples/api/urls.py
from django.http import Http404
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)
from temples import api_views_concierge as concierge

from .views.concierge_history import ConciergeHistoryView
from .views.favorite import FavoriteToggleView, MyFavoriteDestroyView, MyFavoritesListCreateView
from .views.geocode import GeocodeReverseView, GeocodeSearchView
from .views.route import RouteAPIView, RouteView
from .views.search import detail, nearby_search, photo, search, text_search
from .views.shrine import ShrineViewSet  # RankingAPIView は router外なら残してOK

app_name = "temples"

router = DefaultRouter()
router.register(r"shrines", ShrineViewSet, basename="shrine")


def _blocked_shrine_detail(request, pk: int, *args, **kwargs):
    raise Http404()


urlpatterns = [
    # Routes
    path("route/", RouteAPIView.as_view(), name="route"),
    path("shrines/<int:pk>/route/", RouteView.as_view(), name="shrine_route"),
    # Concierge
    path("concierge/chat/", concierge.chat, name="concierge-chat"),
    path("concierge/plan/", concierge.plan, name="concierge-plan"),
    path("concierge/history/", ConciergeHistoryView.as_view(), name="concierge-history"),
    # Ranking（必要なら残す。ViewSet内でやるならこっちは削除）
    # path("popular/", RankingAPIView.as_view(), name="popular-shrines"),
    # Places
    path("places/search/", search, name="places-search"),
    path("places/text_search/", text_search, name="places-text-search"),
    path("places/photo/", photo, name="places-photo"),
    path("places/nearby_search/", nearby_search, name="places-nearby-search"),
    path("places/<str:place_id>/", detail, name="places-detail"),
    # Favorites（重複排除：これだけに統一）
    path("favorites/", MyFavoritesListCreateView.as_view(), name="favorites-list-create"),
    path("favorites/toggle/", FavoriteToggleView.as_view(), name="favorites-toggle"),
    path("favorites/<int:favorite_id>/", MyFavoriteDestroyView.as_view(), name="favorites-destroy"),
    # Geocode
    path("geocode/search/", GeocodeSearchView.as_view()),
    path("geocode/reverse/", GeocodeReverseView.as_view()),
    path("auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/token/verify/", TokenVerifyView.as_view(), name="token_verify"),
    # 最後に router（rest の shrines 一式）
    path("", include(router.urls)),
]
