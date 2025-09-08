# backend/temples/urls.py
app_name = "temples"

from django.urls import path, include, re_path
from rest_framework.routers import DefaultRouter
from .api_views import (
    ShrineViewSet, FavoriteViewSet,
    PlacesSearchView, PlacesDetailView,
    PlacesTextSearchPagedView, PlacesNearbySearchView, PlacesPhotoProxyView, RouteAPIView
)
from .views import PopularShrinesView
from . import views


router = DefaultRouter()
router.register(r"favorites", FavoriteViewSet, basename="favorite")
router.register(r"shrines",   ShrineViewSet,   basename="shrine")

# APIの一覧にだけ下線名エイリアスを付ける（/api/shrines/）
api_shrine_list = ShrineViewSet.as_view({"get": "list"})

urlpatterns = [
    # --- HTMLページ（テストが参照する名前）---
    path("shrines/<int:pk>/",       views.shrine_detail, name="shrine_detail"),
    path("shrines/<int:pk>/route/", views.shrine_route,  name="shrine_route"),

    # --- DRF ViewSet（一覧だけ下線名の別名を用意）---
    path("shrines/", api_shrine_list, name="shrine_list"),
    path("shrines/popular/", PopularShrinesView.as_view(), name="popular-shrines"),

    # --- ルート計算 API ---
    path("route/", RouteAPIView.as_view(), name="route_api"),

    # --- Places API ---
    path("places/search/",        PlacesSearchView.as_view(),          name="places_search"),
    path("places/text_search/",   PlacesTextSearchPagedView.as_view(), name="places_text_search"),
    path("places/nearby_search/", PlacesNearbySearchView.as_view(),    name="places_nearby_search"),
    path("places/photo/",         PlacesPhotoProxyView.as_view(),      name="places_photo"),
    re_path(r"^places/(?P<place_id>[A-Za-z0-9._=-]{20,200})/$",
            PlacesDetailView.as_view(), name="places_detail"),

    # --- DRF ルーター（最後に）---
    path("", include(router.urls)),
]
