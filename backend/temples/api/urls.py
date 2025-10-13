# backend/temples/api/urls.py
from django.http import Http404
from django.urls import include, path
from rest_framework.routers import DefaultRouter

# JWT
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView, TokenVerifyView

# ✅ 必要な view の import を全部揃える
from temples import api_views_concierge as concierge

from .views.concierge_history import ConciergeHistoryView
from .views.favorite import FavoriteToggleView, MyFavoriteDestroyView, MyFavoritesListCreateView
from .views.geocode import GeocodeReverseView, GeocodeSearchView
from .views.route import RouteAPIView, RouteView
from .views.search import detail, nearby_search, photo, search, text_search

# popular が Shrine モジュール側の CBV ならこれも（名称は手元の実装に合わせて）
from .views.shrine import (
    RankingAPIView,  # なければ相応の Popular 用ビューを import
    ShrineViewSet,
)

app_name = "temples"

router = DefaultRouter()
router.register(r"shrines", ShrineViewSet, basename="shrine")

# ViewSet の明示エイリアス（テストが期待する URL 名）
shrine_list_view = ShrineViewSet.as_view({"get": "list"})
shrine_detail_view = ShrineViewSet.as_view({"get": "retrieve"})


def _blocked_shrine_detail(request, pk: int, *args, **kwargs):
    raise Http404()


urlpatterns = [
    # Route API / Page
    path("route/", RouteAPIView.as_view(), name="route"),
    path("shrines/<int:pk>/route/", RouteView.as_view(), name="shrine_route"),
    # ★ テストで使われる名前
    path("shrines/", shrine_list_view, name="shrine_list"),
    path("shrines/<int:pk>/", _blocked_shrine_detail, name="shrine_detail"),
    # ★ 人気順（テストは reverse('temples:popular-shrines') を使う）
    path("popular/", RankingAPIView.as_view(), name="popular-shrines"),
    # Concierge
    path("concierge/chat/", concierge.chat, name="concierge-chat"),
    path("concierge/plan/", concierge.plan, name="concierge-plan"),
    path("concierge/history/", ConciergeHistoryView.as_view(), name="concierge-history"),
    # Places
    path("places/search/", search, name="places-search"),
    path("places/text_search/", text_search, name="places-text-search"),
    path("places/photo/", photo, name="places-photo"),
    path("places/nearby_search/", nearby_search, name="places-nearby-search"),
    path("places/<str:place_id>/", detail, name="places-detail"),
    # Favorites
    path("favorites/", MyFavoritesListCreateView.as_view(), name="favorites-list-create"),
    path("favorites/toggle/", FavoriteToggleView.as_view(), name="favorites-toggle"),
    path("favorites/<int:favorite_id>/", MyFavoriteDestroyView.as_view(), name="favorites-destroy"),
    # Geocode
    path("geocode/search/", GeocodeSearchView.as_view()),
    path("geocode/reverse/", GeocodeReverseView.as_view()),
    # JWT
    path("auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/token/verify/", TokenVerifyView.as_view(), name="token_verify"),
    # Router（最後）
    path("", include(router.urls)),
]
