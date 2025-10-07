# backend/temples/urls.py
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from temples.api.views.search import search  # 既存の search 関数を再利用

from .api_views import (
    FavoriteViewSet,  # ← ShrineViewSet は router から外す
    RouteAPIView,
    ShrineNearbyView,
)
from .api_views_concierge import ConciergeChatView, ConciergePlanView
from .api_views_places import (
    PlaceDetailView,
    PlacesNearbySearchView,
    PlacesSearchView,
    PlacesTextSearchView,
    place_photo,
)
from .views import (
    PopularShrinesView,  # shrine_list 用に必要なら import
    shrine_detail,
    shrine_list,
    shrine_route,
)

app_name = "temples"

router = DefaultRouter()
router.register(r"favorites", FavoriteViewSet, basename="favorite")
# router.register(r"shrines", ShrineViewSet, basename="shrine")  # ← 競合するので削除

urlpatterns = [
    # ★ まず“明示パス”を先に
    path("shrines/popular/", PopularShrinesView.as_view(), name="popular-shrines"),
    path(
        "shrines/", shrine_list, name="shrine_list"
    ),  # もしくは ShrineViewSet.as_view({"get":"list"})
    path("shrines/<int:pk>/", shrine_detail, name="shrine_detail"),
    path("shrines/<int:pk>/route/", shrine_route, name="shrine_route"),
    path("search/", search, name="search"),
    path("shrines/nearby", ShrineNearbyView.as_view(), name="shrines-nearby"),
    # その後に Router
    path("", include(router.urls)),
    # places
    path("places/search/", PlacesSearchView.as_view(), name="places_search"),
    path("places/text_search/", PlacesTextSearchView.as_view(), name="places_text_search"),
    path("places/nearby_search/", PlacesNearbySearchView.as_view(), name="places_nearby_search"),
    path("places/photo/", place_photo, name="places_photo"),
    path("places/<str:place_id>/", PlaceDetailView.as_view(), name="place-detail"),
    # concierge
    path("concierge/chat/", ConciergeChatView.as_view(), name="concierge_chat"),
    path("concierge/plan/", ConciergePlanView.as_view(), name="concierge_plan"),
    # route API
    path("route/", RouteAPIView.as_view(), name="route"),
]
