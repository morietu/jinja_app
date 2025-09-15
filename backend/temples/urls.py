# backend/temples/urls.py
app_name = "temples"

from django.urls import path, include, re_path
from rest_framework.routers import DefaultRouter
from importlib import import_module

# ---- api_views を柔軟にロード ----
try:
    api = import_module("temples.api_views")
except Exception:
    api = None

def bind(name):
    return getattr(api, name, None) if api else None

ShrineViewSet             = bind("ShrineViewSet")
FavoriteViewSet           = bind("FavoriteViewSet")
PublicGoshuinViewSet      = bind("PublicGoshuinViewSet")
GoshuinViewSet            = bind("GoshuinViewSet")
MyGoshuinViewSet          = bind("MyGoshuinViewSet")

NearbyShrinesView         = bind("NearbyShrinesView")
PlacesSearchView          = bind("PlacesSearchView")
PlacesTextSearchPagedView = bind("PlacesTextSearchPagedView")
PlacesNearbySearchView    = bind("PlacesNearbySearchView")
PlacesPhotoProxyView      = bind("PlacesPhotoProxyView")
PlacesFindPlaceView       = bind("PlacesFindPlaceView")
PlacesDetailView          = bind("PlacesDetailView")

RouteAPIView              = bind("RouteAPIView")
ConciergePlanView         = bind("ConciergePlanView")

# ---- HTML ビュー（存在するものだけ）----
try:
    from .views import PopularShrinesView, shrine_detail, shrine_route
except Exception:
    PopularShrinesView = None
    shrine_detail = None
    shrine_route = None

# ---- DRF Routers ----
router = DefaultRouter()
if FavoriteViewSet:
    router.register(r"favorites", FavoriteViewSet, basename="favorite")
if ShrineViewSet:
    router.register(r"shrines", ShrineViewSet, basename="shrine")
if PublicGoshuinViewSet:
    router.register(r"goshuin/public", PublicGoshuinViewSet, basename="goshuin-public")
if GoshuinViewSet:
    router.register(r"goshuin", GoshuinViewSet, basename="goshuin")

my_router = DefaultRouter()
if MyGoshuinViewSet:
    my_router.register(r"goshuin", MyGoshuinViewSet, basename="my-goshuin")

urlpatterns = []

# --- まず API を先に（/api/shrines/<id>/ を必ずDRFへ）---
if my_router.registry:
    urlpatterns.append(path("my/", include(my_router.urls)))
urlpatterns.append(path("", include(router.urls)))

# --- Shrine 拡張 API ---
if PopularShrinesView:
    urlpatterns.append(path("shrines/popular/", PopularShrinesView.as_view(), name="popular-shrines"))
if NearbyShrinesView:
    urlpatterns.append(path("shrines/nearby/",  NearbyShrinesView.as_view(),  name="shrines-nearby"))

# --- ルート計算 / Concierge ---
if RouteAPIView:
    urlpatterns.append(path("route/", RouteAPIView.as_view(), name="route_api"))
if ConciergePlanView:
    urlpatterns.append(path("concierge/plan/", ConciergePlanView.as_view(), name="concierge-plan"))

# --- Places API ---
if PlacesFindPlaceView:
    urlpatterns.append(path("places/find_place/",    PlacesFindPlaceView.as_view(),       name="places_find_place"))
if PlacesSearchView:
    urlpatterns.append(path("places/search/",        PlacesSearchView.as_view(),          name="places_search"))
if PlacesTextSearchPagedView:
    urlpatterns.append(path("places/text_search/",   PlacesTextSearchPagedView.as_view(), name="places_text_search"))
if PlacesNearbySearchView:
    urlpatterns.append(path("places/nearby_search/", PlacesNearbySearchView.as_view(),    name="places_nearby_search"))
if PlacesPhotoProxyView:
    urlpatterns.append(path("places/photo/",         PlacesPhotoProxyView.as_view(),      name="places_photo"))
if PlacesDetailView:
    urlpatterns.append(
        re_path(
            r"^places/(?P<place_id>[A-Za-z0-9._=-]{10,200})/$",
            PlacesDetailView.as_view(),
            name="places_detail",
        )
    )

# --- HTML ページは衝突しないよう /pages/ 配下へ ---
if shrine_detail:
    urlpatterns.append(path("pages/shrines/<int:pk>/",       shrine_detail, name="shrine_detail"))
if shrine_route:
    urlpatterns.append(path("pages/shrines/<int:pk>/route/", shrine_route,  name="shrine_route"))
