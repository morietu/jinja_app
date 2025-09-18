# backend/temples/api_urls.py
from django.urls import path
from rest_framework.routers import DefaultRouter
from temples.api.views.concierge import ConciergeChatView
from .api_views import (
    PublicGoshuinViewSet, MyGoshuinViewSet,
    ShrineViewSet, FavoriteViewSet,
    NearbyShrinesView, PlacesFindPlaceView,
    PlacesTextSearchPagedView, PlacesNearbySearchView,
    PlacesPhotoProxyView, PlacesDetailView, RouteAPIView,
    ConciergePlanView,
)

router = DefaultRouter()
router.register(r"goshuin", PublicGoshuinViewSet, basename="goshuin")
router.register(r"my/goshuin", MyGoshuinViewSet, basename="my-goshuin")
router.register(r"shrines", ShrineViewSet, basename="shrine")
router.register(r"favorites", FavoriteViewSet, basename="favorite")

app_name = "temples"

urlpatterns = [
    # APIView 系（順不同でOK。prefix はここで統一）
    path("shrines/nearby/", NearbyShrinesView.as_view(), name="shrines-nearby"),
    path("concierge/plan/", ConciergePlanView.as_view(), name="concierge-plan"),
    path("concierge/chat/", ConciergeChatView.as_view(), name="concierge-chat"),
    path("route/", RouteAPIView.as_view(), name="route"),

    # Places 系
    path("places/find_place/", PlacesFindPlaceView.as_view(), name="places-find"),
    path("places/text_search/", PlacesTextSearchPagedView.as_view(), name="places-text"),
    path("places/nearby_search/", PlacesNearbySearchView.as_view(), name="places-nearby"),
    path("places/photo/", PlacesPhotoProxyView.as_view(), name="places-photo"),
    path("places/details/<str:place_id>/", PlacesDetailView.as_view(), name="places-detail"),
]

# 最後に router.urls を結合
urlpatterns += router.urls
