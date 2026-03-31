# /app/temples/urls.py
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from temples.views.admin_seed import seed_initial_shrine
from temples.api.views.route import RouteView
from temples.api.views.search import search
from temples.views.places import (
    PlacesTextSearchView,
    PlacesNearbySearchView,
    PlacesDetailsView,
    PlacesPhotoProxyView,
    PlacesFindLiteView,
)

from .api_views import FavoriteViewSet, ShrineNearbyView
from .api_views_concierge import ConciergeChatView, ConciergePlanView
from .views import PopularShrinesView, shrine_list, shrine_route, shrine_detail

app_name = "temples"

router = DefaultRouter()
router.register(r"favorites", FavoriteViewSet, basename="favorite")

urlpatterns = [
    path("shrines/popular/", PopularShrinesView.as_view(), name="popular-shrines"),
    path("shrines/", shrine_list, name="shrine_list"),
    path("shrines/<int:pk>/", shrine_detail, name="shrine_detail"),
    path("shrines/<int:pk>/route/", shrine_route, name="shrine_route"),
    path("search/", search, name="search"),
    path("shrines/nearby", ShrineNearbyView.as_view(), name="shrines-nearby"),
    path("", include(router.urls)),
    path("places/text_search/", PlacesTextSearchView.as_view(), name="places_text_search"),
    path("places/nearby_search/", PlacesNearbySearchView.as_view(), name="places_nearby_search"),
    path("places/photo/", PlacesPhotoProxyView.as_view(), name="places_photo"),
    path("places/<str:place_id>/", PlacesDetailsView.as_view(), name="place-detail"),
    path("places/find/", PlacesFindLiteView.as_view(), name="places-find-lite"),
    path("concierge/chat/", ConciergeChatView.as_view(), name="concierge_chat"),
    path("concierge/plan/", ConciergePlanView.as_view(), name="concierge_plan"),
    path("route/", RouteView.as_view(), name="route"),
    path("admin/seed/shrine/", seed_initial_shrine),
]
