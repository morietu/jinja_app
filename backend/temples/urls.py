# backend/temples/urls.py
app_name = "temples"

from django.urls import path, include, re_path
from rest_framework.routers import DefaultRouter
from .api_views import (
    ShrineViewSet, FavoriteViewSet,
    PlacesSearchView, PlacesDetailView,
    PlacesTextSearchPagedView, PlacesNearbySearchView,
    PlacesPhotoProxyView, RouteAPIView,
    PlacesFindPlaceView,
)
from .views import PopularShrinesView, ConciergePlanView
from . import views

router = DefaultRouter()
router.register(r"favorites", FavoriteViewSet, basename="favorite")
router.register(r"shrines",   ShrineViewSet,   basename="shrine")

api_shrine_list = ShrineViewSet.as_view({"get": "list"})

urlpatterns = [
    # --- HTMLページ ---
    path("shrines/<int:pk>/",       views.shrine_detail, name="shrine_detail"),
    path("shrines/<int:pk>/route/", views.shrine_route,  name="shrine_route"),

    # --- DRF ViewSet ---
    path("shrines/", api_shrine_list, name="shrine_list"),
    path("shrines/popular/", PopularShrinesView.as_view(), name="popular-shrines"),

    # --- ルート計算 API ---
    path("route/", RouteAPIView.as_view(), name="route_api"),

    # --- Places API ---
path("places/search/",        PlacesSearchView.as_view(),          name="places_search"),
path("places/text_search/",   PlacesTextSearchPagedView.as_view(), name="places_text_search"),
path("places/nearby_search/", PlacesNearbySearchView.as_view(),    name="places_nearby_search"),
path("places/photo/",         PlacesPhotoProxyView.as_view(),      name="places_photo"),

# ★ Find Place を先に明示
path("places/find_place/",    PlacesFindPlaceView.as_view(),       name="places_find_place"),

# ★ details は厳しめ regex で最後に
re_path(
    r"^places/(?P<place_id>[A-Za-z0-9._=-]{20,200})/$",
    PlacesDetailView.as_view(),
    name="places_detail",
),

    # --- DRF ルーター（最後に）---
    path("", include(router.urls)),
]
