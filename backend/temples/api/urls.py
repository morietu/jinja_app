# backend/temples/api/urls.py
from django.http import Http404
from django.urls import include, path
from django.views.decorators.http import require_http_methods
from rest_framework.routers import DefaultRouter
from temples import api_views_concierge as concierge
from temples.api.views.search import detail_query, nearby_search_legacy

from .views.concierge_history import ConciergeHistoryView
from .views.favorite import FavoriteToggleView, MyFavoriteDestroyView, MyFavoritesListCreateView
from .views.geocode import (
    GeocodeReverseView,
    GeocodeReverseViewLegacy,
    GeocodeSearchView,
    GeocodeSearchViewLegacy,
)
from .views.route import RouteAPIView, RouteLegacyAPIView, RouteView
from .views.search import detail, nearby_search, photo, search, text_search, text_search_legacy
from .views.shrine import RankingAPIView, ShrineViewSet

app_name = "temples"

router = DefaultRouter()
router.register(r"shrines", ShrineViewSet, basename="shrine")

# ViewSet の明示エイリアス（テストで reverse 名称を使うケース対策）
shrine_list_view = ShrineViewSet.as_view({"get": "list"})
shrine_detail_view = ShrineViewSet.as_view({"get": "retrieve"})


def _blocked_shrine_detail(request, pk: int, *args, **kwargs):
    # temples 側の詳細 API は別口（またはブロック）という仕様なので 404
    raise Http404()

    return detail(request, place_id=id, **kwargs)


@require_http_methods(["DELETE"])
def my_favorite_destroy_by_id(request, id: int, *args, **kwargs):
    # 既存 CBV は favorite_id を要求するので受け渡し
    view = MyFavoriteDestroyView.as_view()
    # kwargs に favorite_id を詰めて渡す
    request.resolver_match = None  # 念のため
    return view(request, favorite_id=id, **kwargs)


urlpatterns = [
    # ---- Routes（複数形） ---------------------------------------------------
    path("routes/", RouteAPIView.as_view(), name="route"),
    path("shrines/<int:pk>/route/", RouteView.as_view(), name="shrine_route"),
    # ---- Shrines（ViewSet の読み取り用に名前を固定） ------------------------
    path("shrines/", shrine_list_view, name="shrine_list"),
    path("shrines/<int:pk>/", _blocked_shrine_detail, name="shrine_detail"),
    # ---- Popular（複数形に） ------------------------------------------------
    # reverse('temples:popular-shrines') はそのまま維持
    path("populars/", RankingAPIView.as_view(), name="popular-shrines"),
    # ---- Concierge（複数形に寄せる） ---------------------------------------
    path("concierges/chats/", concierge.chat, name="concierge-chat"),
    path("concierges/plans/", concierge.plan, name="concierge-plan"),
    path("concierges/histories/", ConciergeHistoryView.as_view(), name="concierge-history"),
    # ---- Places（kebab-case & {id} 統一） -----------------------------------
    path("places/search/", search, name="places-search"),
    path("places/text-search/", text_search, name="places-text-search"),
    path("places/text_search/", text_search_legacy, name="places-text-search-legacy"),
    path("places/photo/", photo, name="places-photo"),
    path("places/nearby-search/", nearby_search, name="places-nearby-search"),
    path("places/nearby_search/", nearby_search_legacy, name="places-nearby-search-legacy"),
    # detail（query 版 /id 版）
    path("places/detail/", detail_query, name="places-detail"),
    path("places/detail/<str:id>/", detail, name="places-detail-id"),
    # 最後にショート版のキャッチオール
    path("places/<str:id>/", detail, name="places-detail-short"),
    # ---- Favorites（{id} 統一／トグルはそのまま） ---------------------------
    path("favorites/", MyFavoritesListCreateView.as_view(), name="favorites-list-create"),
    path("favorites/toggle/", FavoriteToggleView.as_view(), name="favorites-toggle"),
    path("favorites/<int:id>/", my_favorite_destroy_by_id, name="favorites-destroy"),
    # ---- Geocodes（複数形に） -----------------------------------------------
    path("geocodes/search/", GeocodeSearchView.as_view(), name="geocodes-search"),
    path("geocodes/reverse/", GeocodeReverseView.as_view(), name="geocodes-reverse"),
    path("geocode/search/", GeocodeSearchViewLegacy.as_view(), name="geocode-search-legacy"),
    path("geocode/reverse/", GeocodeReverseViewLegacy.as_view(), name="geocode-reverse-legacy"),
    path("route/", RouteLegacyAPIView.as_view(), name="route"),
    # ---- Router（最後） -----------------------------------------------------
    path("", include(router.urls)),
]
