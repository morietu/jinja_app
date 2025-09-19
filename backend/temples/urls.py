from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .api_views import (
    ShrineViewSet, FavoriteViewSet,
    PublicGoshuinViewSet, MyGoshuinViewSet,
    NearbyShrinesView,
    PlacesSearchView, PlacesTextSearchPagedView, PlacesNearbySearchView,
    PlacesPhotoProxyView, PlacesDetailView, PlacesFindPlaceView,  # ← 使わないなら削除可
    RouteAPIView,ConciergeChatView, ConciergeHistoryView, RankingView,
)

router = DefaultRouter()
router.register(r"shrines", ShrineViewSet, basename="shrine")
router.register(r"favorites", FavoriteViewSet, basename="favorite")
router.register(r"goshuin/public", PublicGoshuinViewSet, basename="goshuin-public")
router.register(r"goshuin", MyGoshuinViewSet, basename="goshuin")

urlpatterns = [
    # 先に個別エンドポイントを並べる
    path("shrines/nearby/", NearbyShrinesView.as_view(), name="shrines_nearby"),
    path("places/search/", PlacesSearchView.as_view(), name="places_search"),
    path("places/search/paged/", PlacesTextSearchPagedView.as_view(), name="places_search_paged"),
    path("places/nearby/", PlacesNearbySearchView.as_view(), name="places_nearby"),
    path("places/photo/", PlacesPhotoProxyView.as_view(), name="places_photo"),
    path("places/detail/<str:place_id>/", PlacesDetailView.as_view(), name="places_detail"),
    path("places/find/", PlacesFindPlaceView.as_view(), name="places_find"),  # ← 未実装ならこの行ごと削除OK
    path("route/", RouteAPIView.as_view(), name="route"),
    path("concierge/chat/", ConciergeChatView.as_view(), name="concierge-chat"),
    path("concierge/history/", ConciergeHistoryView.as_view()),
    path("temples/concierge/history/", ConciergeHistoryView.as_view(), name="concierge-history"),
    path("ranking/", RankingView.as_view(), name="ranking"),
    # 最後に router を include
    path("", include(router.urls)),
]

# --- concierge endpoint (scaffold) ---
from django.urls import path  # 既にある場合は無視されます
from .api_views_concierge import ConciergeChatView  # 既にある場合は無視されます

urlpatterns += [
    path("concierge/chat/", ConciergeChatView.as_view(), name="concierge-chat"),
]
