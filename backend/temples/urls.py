# backend/temples/urls.py
app_name = "temples"

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .api_views import (
    ShrineViewSet, FavoriteViewSet,
    PublicGoshuinViewSet, MyGoshuinViewSet,
)
from .api_views_concierge import ConciergeChatView
from .views import (
    ShrineDetailView, ShrineRouteView, PopularShrinesView,
    shrine_list,  # 逆引きテスト用の名前 'shrine_list'
    ShrineDetailView, ShrineRouteView, PopularShrinesView,
    shrine_list, RouteAPIView,  # ← RouteAPIView を追加
)
from .api_views_places import (
    PlacesTextSearchView, PlacesNearbySearchView, PlacesSearchView,
    PlaceDetailView, PlacesPhotoProxyView,
)

router = DefaultRouter()
router.register(r"shrines", ShrineViewSet, basename="shrine")
router.register(r"favorites", FavoriteViewSet, basename="favorite")
router.register(r"goshuin/public", PublicGoshuinViewSet, basename="goshuin-public")
router.register(r"goshuin", MyGoshuinViewSet, basename="goshuin")

urlpatterns = [
    # --- HTML views used by tests ---
    path("shrines/<int:pk>/view/",  ShrineDetailView.as_view(), name="shrine_detail"),
    path("shrines/<int:pk>/route/", ShrineRouteView.as_view(),  name="shrine_route"),

    # 逆引きテスト対策：DRFの 'shrine-list' とは別に 'shrine_list' も名前解決できるよう同一パスに名前を付与
    # ViewSetのlistにフォワードしたい場合は以下でもOK（必要なら差し替え）
    path("shrines/", shrine_list, name="shrine_list"),
    # --- concierge ---
    path("concierge/chat/", ConciergeChatView.as_view(), name="concierge-chat"),

    # --- Popular API ---
    path("popular/", PopularShrinesView.as_view(), name="popular-shrines"),

    # --- places（順序重要：photo を detail より前に） ---
    path("places/text_search/",   PlacesTextSearchView.as_view(),   name="places-text-search"),
    path("places/nearby_search/", PlacesNearbySearchView.as_view(), name="places-nearby-search"),
    path("places/search/",        PlacesSearchView.as_view(),       name="places-search"),
    path("places/photo/",         PlacesPhotoProxyView.as_view(),   name="places-photo"),
    path("places/<str:place_id>/", PlaceDetailView.as_view(),       name="places-detail"),

    # --- route API ---
    path("route/", RouteAPIView.as_view(), name="route"),

    # router 最後
    path("", include(router.urls)),
]
