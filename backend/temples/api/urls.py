# backend/temples/api/urls.py
from django.http import Http404
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from temples import api_views_concierge as concierge
from temples.api.views.search import detail_query

from .views.concierge_history import ConciergeHistoryView
from .views.route import RouteAPIView, RouteView
from .views.shrine import RankingAPIView, ShrineViewSet

# /api/places/<id>/ のショート版。search.py に detail_short が無い環境でも動作させる。
try:
    from temples.api.views.search import detail_short  # type: ignore
except Exception:
    from drf_spectacular.utils import extend_schema
    from rest_framework.decorators import api_view, permission_classes
    from rest_framework.permissions import AllowAny

    def _as_django_request(req):
        # DRF Request のときは _request を取り出して HttpRequest に剥がす
        try:
            from rest_framework.request import Request as DRFRequest

            if isinstance(req, DRFRequest):
                return getattr(req, "_request", req)
        except Exception:
            pass
        return req

    @extend_schema(exclude=True)
    @api_view(["GET"])
    @permission_classes([AllowAny])
    def detail_short(request, id: str, *args, **kwargs):  # type: ignore
        dj_req = _as_django_request(request)
        # B026 回避のため位置引数で渡す
        return detail(dj_req, id, *args, **kwargs)


# geocode の関数名差異に対応
try:
    from temples.api.views.geocode import search as geocode_search
except ImportError:  # geocode_search 直名
    from temples.api.views.geocode import geocode_search  # type: ignore

try:
    from temples.api.views.geocode import reverse as geocode_reverse
except ImportError:  # reverse_geocode 名
    from temples.api.views.geocode import reverse_geocode as geocode_reverse  # type: ignore


app_name = "temples"

router = DefaultRouter()
router.register(r"shrines", ShrineViewSet, basename="shrine")

# ViewSet の明示エイリアス（reverse 名称の安定化）
shrine_list_view = ShrineViewSet.as_view({"get": "list"})
shrine_detail_view = ShrineViewSet.as_view({"get": "retrieve"})  # 参照される可能性があるため維持


def _blocked_shrine_detail(request, pk: int, *args, **kwargs):
    # temples 側の詳細 API は別口（またはブロック）という仕様なので 404
    raise Http404()


urlpatterns = [
    # ---- Routes（複数形） ---------------------------------------------------
    path("routes/", RouteAPIView.as_view(), name="route"),
    path("shrines/<int:pk>/route/", RouteView.as_view(), name="shrine_route"),
    # ---- Shrines（ViewSet の読み取り用に名前を固定） ------------------------
    path("shrines/", shrine_list_view, name="shrine_list"),
    path("shrines/<int:pk>/", _blocked_shrine_detail, name="shrine_detail"),
    # ---- Popular（複数形に） ------------------------------------------------
    path("populars/", RankingAPIView.as_view(), name="popular-shrines"),
    # ---- Concierge（複数形に寄せる） ---------------------------------------
    path("concierges/chats/", concierge.chat, name="concierge-chat"),
    path("concierges/plans/", concierge.plan, name="concierge-plan"),
    path("concierges/histories/", ConciergeHistoryView.as_view(), name="concierge-history"),
    # ---- Places（kebab-case & {id} 統一） -----------------------------------
    path("places/search/", search, name="places-search"),
    path("places/detail/", detail_query, name="places-detail"),
    path("places/text-search/", text_search, name="places-text-search"),
    path("places/text_search/", text_search_legacy, name="places-text-search-legacy"),
    path("places/photo/", photo, name="places-photo"),
    path("places/nearby-search/", nearby_search, name="places-nearby-search"),
    # ---- Favorites（{id} 統一／トグルはそのまま） ---------------------------
    path("favorites/", MyFavoritesListCreateView.as_view(), name="favorites-list-create"),
    path("favorites/toggle/", FavoriteToggleView.as_view(), name="favorites-toggle"),
    path("favorites/<int:id>/", my_favorite_destroy_by_id, name="favorites-destroy"),
    # ---- Geocodes（複数形に） -----------------------------------------------
    path("geocodes/search/", GeocodeSearchView.as_view(), name="geocodes-search"),
    path("geocodes/reverse/", GeocodeReverseView.as_view(), name="geocodes-reverse"),
    path("geocode/search/", GeocodeSearchViewLegacy.as_view(), name="geocode-search-legacy"),
    path("geocode/reverse/", GeocodeReverseViewLegacy.as_view(), name="geocode-reverse-legacy"),
    path("route/", RouteLegacyAPIView.as_view(), name="route"),
    # ---- Router（最後） -----------------------------------------------------
    path("", include(router.urls)),
]
