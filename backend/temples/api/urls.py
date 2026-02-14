# backend/temples/api/urls.py
from django.http import Http404,  JsonResponse
from django.urls import include, path
from drf_spectacular.utils import extend_schema
from rest_framework.routers import DefaultRouter


from temples.api.views.public_profile import public_profile
from temples.api.views.search import places_find
from temples.api.views.shrine import PopularShrineListView
from temples.api.views.tags import goriyaku_tags_list
from temples.api.views.goshuin_feed import PublicGoshuinFeedView

from temples.api.views.billing import BillingStatusView, BillingStatusLegacyView
from temples.api.views.place_cache import place_cache_list

from temples.api.views.places_resolve import PlacesResolveView

from temples.api_views import FavoriteViewSet


# Concierge の互換シム
from temples import api_views_concierge as concierge
from temples.api.views.concierge import (
    ConciergeThreadListView,
    ConciergeThreadDetailView,
)

# geocode (レガシー互換も吸収)
from temples.api.views.geocode import geocode_reverse_legacy, geocode_search_legacy
from temples.api.views.compat import concierge_chat_compat

# shrine / search
from temples.api.views.search import (
    detail,
    detail_query,
    nearby_search,
    nearby_search_legacy,
    photo,
    search,
    text_search,
    text_search_legacy,
)
from temples.api.views.shrine import (
    NearestShrinesAPIView,
    ShrineViewSet,
)
from temples.api.views.goshuin import (
    PublicGoshuinViewSet,
    MyGoshuinViewSet,       
)

try:
    from temples.api.views.geocode import search as geocode_search
except ImportError:  # geocode_search 直名
    from temples.api.views.geocode import geocode_search  # type: ignore

try:
    from temples.api.views.geocode import reverse as geocode_reverse
except ImportError:  # reverse_geocode 名
    from temples.api.views.geocode import reverse_geocode as geocode_reverse  # type: ignore

# route（存在しない環境があるためフォールバックを用意）
try:
    from temples.api.views.route import RouteAPIView, RouteView, route_health  # type: ignore
except Exception:
    from temples.api.views.route import RouteAPIView, RouteView  # type: ignore

    def route_health(request):
        return JsonResponse({"status": "ok", "service": "route"})

# /api/places/<id>/ のショート版。search.py に detail_short が無い環境でも動作させる。
try:
    from temples.api.views.search import detail_short  # type: ignore
except Exception:
    from rest_framework.decorators import api_view, permission_classes
    from rest_framework.permissions import AllowAny
    from rest_framework.request import Request as DRFRequest

    def _as_django_request(req):
        if isinstance(req, DRFRequest):
            return getattr(req, "_request", req)
        return req

    @extend_schema(exclude=True)
    @api_view(["GET"])
    @permission_classes([AllowAny])
    def detail_short(request, id: str, *args, **kwargs):  # type: ignore
        dj_req = _as_django_request(request)
        return detail(dj_req, id, *args, **kwargs)
        
app_name = "temples"

router = DefaultRouter()
router.register(r"goshuins", PublicGoshuinViewSet, basename="goshuins")
router.register(r"my/goshuins", MyGoshuinViewSet, basename="my-goshuins")
router.register(r"shrines", ShrineViewSet, basename="shrine")
router.register(r"favorites", FavoriteViewSet, basename="favorite")

# ★ MyGoshuinViewSet のエイリアス（単数形パス用）
my_goshuin_list_view = MyGoshuinViewSet.as_view({"get": "list", "post": "create"})
my_goshuin_detail_view = MyGoshuinViewSet.as_view(
    {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
)

# ViewSet の明示エイリアス（reverse 名称の安定化）
shrine_list_view = ShrineViewSet.as_view({"get": "list", "post": "create"})
shrine_detail_view = ShrineViewSet.as_view({"get": "retrieve"})  # /data/ 用

def _blocked_shrine_detail(request, pk: int, *args, **kwargs):
    raise Http404()

urlpatterns = [
    # ---- Routes -----------------------------------------------------------
    path("routes/", RouteAPIView.as_view(), name="routes"),
    path("shrines/<int:pk>/route/", RouteView.as_view(), name="shrine_route"),
    path("routes/health/", route_health, name="route_health"),
    path("route/", RouteAPIView.as_view(), name="route-legacy"),

    # ---- Shrines ----------------------------------------------------------
    
    path("shrines/", shrine_list_view, name="shrine_list"),
    path("shrines/<int:pk>/", shrine_detail_view, name="shrine_detail"),
    path("shrines/<int:pk>/data/", shrine_detail_view, name="shrine_detail_data"),
    path("shrines/nearby/", NearestShrinesAPIView.as_view(), name="nearby"),
    

    # --- My Goshuin（単数形互換） ---
    path("my/goshuin/", my_goshuin_list_view, name="my-goshuin-list-compat"),
    path("my/goshuin/<int:pk>/", my_goshuin_detail_view, name="my-goshuin-detail-compat"),

    # ---- Popular ----------------------------------------------------------
    path("populars/", PopularShrineListView.as_view(), name="popular-shrines"),

    # ---- Concierge --------------------------------------------------------
    path("concierge/chat/", concierge_chat_compat, name="concierge-chat"),
    path("concierge/chat", concierge_chat_compat, name="concierge-chat-noslash"),
    path("concierge/plan/", concierge.plan, name="concierge-plan"),

    path("concierge-threads/", ConciergeThreadListView.as_view(), name="concierge-thread-list"),
    path("concierge-threads", ConciergeThreadListView.as_view(), name="concierge-thread-list-noslash"),
    path("concierge-threads/<int:pk>/", ConciergeThreadDetailView.as_view(), name="concierge-thread-detail"),
    path("concierge-threads/<int:pk>", ConciergeThreadDetailView.as_view(), name="concierge-thread-detail-noslash"),

    # ---- Billing ----------------------------------------------------------
    path("billing/status/", BillingStatusLegacyView.as_view(), name="billing-status-legacy"),
    path("billings/status/", BillingStatusView.as_view(), name="billing-status"),

    # ---- Profiles / Tags / Feed ------------------------------------------
    path("profiles/<str:username>/", public_profile, name="public_profile"),
    path("goriyaku-tags/", goriyaku_tags_list, name="goriyaku-tags"),
    path("goshuins/feed/", PublicGoshuinFeedView.as_view(), name="public-goshuin-feed"),

    # ---- Places -----------------------------------------------------------
    path("places/search/", search, name="places-search"),
    path("places/text-search/", text_search, name="places-text-search"),
    path("places/text_search/", text_search_legacy, name="places-text-search-legacy"),
    path("places/photo/", photo, name="places-photo"),
    path("places/nearby-search/", nearby_search, name="places-nearby-search"),
    path("places/nearby_search/", nearby_search_legacy, name="places-nearby-search-legacy"),
    path("places/detail/", detail_query, name="places-detail"),
    path("places/detail/<str:id>/", detail, name="places-detail-id"),
    path("places/find/", places_find, name="places-find-lite"),
    path("places/resolve/", PlacesResolveView.as_view(), name="places-resolve"),
    path("places/<str:id>/", detail_short, name="places-detail-short"),
    path("place-caches/", place_cache_list, name="place-cache-list"),

    # ---- Geocodes ---------------------------------------------------------
    path("geocodes/search/", geocode_search, name="geocodes-search"),
    path("geocodes/reverse/", geocode_reverse, name="geocodes-reverse"),
    path("geocode/search/", geocode_search_legacy, name="geocode-search-legacy"),
    path("geocode/reverse/", geocode_reverse_legacy, name="geocode-reverse-legacy"),

    # router は最後に1回だけ
    path("", include(router.urls)),
]
