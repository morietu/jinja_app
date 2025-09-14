# backend/temples/urls.py
app_name = "temples"

from django.urls import path, include, re_path
from rest_framework.routers import DefaultRouter

from .api_views import (
    ShrineViewSet,
    FavoriteViewSet,
    PublicGoshuinViewSet,     # ★ 追加
    MyGoshuinViewSet,         # ★ 追加
    NearbyShrinesView,
    PlacesSearchView,
    PlacesTextSearchPagedView,
    PlacesNearbySearchView,
    PlacesPhotoProxyView,
    PlacesFindPlaceView,
    PlacesDetailView,
    RouteAPIView,
)
from .views import PopularShrinesView  # ConciergePlanView はここでは未使用
from . import views

# ---- DRF Router ----
router = DefaultRouter()
router.register(r"favorites",   FavoriteViewSet,     basename="favorite")
router.register(r"shrines",     ShrineViewSet,       basename="shrine")
router.register(r"goshuin",     PublicGoshuinViewSet, basename="goshuin")     # 公開一覧
router.register(r"my/goshuin",  MyGoshuinViewSet,    basename="my-goshuin")   # 自分一覧（要認証）

urlpatterns = [
    # --- HTMLページ（/api/配下で良ければこのまま。不要なら削除OK）---
    path("shrines/<int:pk>/",       views.shrine_detail, name="shrine_detail"),
    path("shrines/<int:pk>/route/", views.shrine_route,  name="shrine_route"),

    # --- API: Shrine 拡張 ---
    path("shrines/popular/", PopularShrinesView.as_view(), name="popular-shrines"),
    path("shrines/nearby/",  NearbyShrinesView.as_view(),  name="shrines-nearby"),

    # --- ルート計算 API ---
    path("route/", RouteAPIView.as_view(), name="route_api"),

    # --- Places API ---
    path("places/find_place/",    PlacesFindPlaceView.as_view(),       name="places_find_place"),
    path("places/search/",        PlacesSearchView.as_view(),          name="places_search"),
    path("places/text_search/",   PlacesTextSearchPagedView.as_view(), name="places_text_search"),
    path("places/nearby_search/", PlacesNearbySearchView.as_view(),    name="places_nearby_search"),
    path("places/photo/",         PlacesPhotoProxyView.as_view(),      name="places_photo"),
    re_path(
        r"^places/(?P<place_id>[A-Za-z0-9._=-]{10,200})/$",            # ★ 10〜200 に統一
        PlacesDetailView.as_view(),
        name="places_detail",
    ),

    # --- DRF ルーター（最後に）---
    path("", include(router.urls)),
]
