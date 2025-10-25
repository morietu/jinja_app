# backend/temples/api/urls.py
from django.http import Http404, HttpResponsePermanentRedirect
from django.urls import include, path
from drf_spectacular.utils import extend_schema
from rest_framework.routers import DefaultRouter
from temples import api_views_concierge as concierge
from temples.api.views.geocode import geocode_reverse_legacy, geocode_search_legacy
from temples.api.views.route import RouteAPIView, RouteView

try:
    # route_health が無い環境があるため、あれば使う/無ければフォールバック
    from temples.api.views.route import route_health  # type: ignore
except ImportError:
    from django.http import JsonResponse

    def route_health(request):
        return JsonResponse({"status": "ok", "service": "route"})


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
from temples.api.views.shrine import RankingAPIView

from .views.concierge_history import ConciergeHistoryView
from .views.shrine import ShrineViewSet

# /api/places/<id>/ のショート版。search.py に detail_short が無い環境でも動作させる。
try:
    from temples.api.views.search import detail_short  # type: ignore
except Exception:
    from drf_spectacular.utils import extend_schema
    from rest_framework.decorators import api_view, permission_classes
    from rest_framework.permissions import AllowAny

    def _as_django_request(req):
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


def _legacy_redirect(path):
    def _view(request, *args, **kwargs):
        return HttpResponsePermanentRedirect(path)

    return _view


urlpatterns = [
    # ---- Routes（複数形: 正規） --------------------------------------------
    path("routes/", RouteAPIView.as_view(), name="routes"),
    path("shrines/<int:pk>/route/", RouteView.as_view(), name="shrine_route"),
    # ---- Shrines（ViewSet の読み取り用に名前を固定） ------------------------
    path("shrines/", shrine_list_view, name="shrine_list"),
    path("shrines/<int:pk>/", _blocked_shrine_detail, name="shrine_detail"),
    # ---- Popular（複数形に） ------------------------------------------------
    # ※ テストは 'popular-shrines' を参照するため、name は従来に合わせる
    path("populars/", RankingAPIView.as_view(), name="popular-shrines"),
    # ---- Concierge（複数形: 正規） ---------------------------------------
    path("concierges/chats/", concierge.chat, name="concierge-chat"),
    path("concierges/plans/", concierge.plan, name="concierge-plan"),
    path("concierges/histories/", ConciergeHistoryView.as_view(), name="concierge-history"),
    # ---- Concierge（単数形: 互換・当面は直結推奨） -----------------------
    # chat: 単数形エンドポイントはOpenAPIスタイル違反になるため schema exclude
    path(
        "concierge/chat/",
        extend_schema(exclude=True)(concierge.chat),
        name="concierge-chat-legacy",
    ),
    path("concierge/plan/", concierge.plan, name="concierge-plan-legacy"),
    # history: 同様に schema exclude（Viewを as_view したものにデコレータ適用）
    path(
        "concierge/history/",
        ConciergeHistoryView.as_view(),
        name="concierge-history-legacy",
    ),
    # ---- Places（kebab-case & {id} 統一） -----------------------------------
    path("places/search/", search, name="places-search"),
    path("places/text-search/", text_search, name="places-text-search"),
    path("places/text_search/", text_search_legacy, name="places-text-search-legacy"),
    path("places/photo/", photo, name="places-photo"),
    path("places/nearby-search/", nearby_search, name="places-nearby-search"),
    path("places/nearby_search/", nearby_search_legacy, name="places-nearby-search-legacy"),
    path("places/detail/", detail_query, name="places-detail"),
    path("places/detail/<str:id>/", detail, name="places-detail-id"),
    path("places/<str:id>/", detail_short, name="places-detail-short"),
    # --- Geocodes (複数形: 正規) ---
    path("geocodes/search/", geocode_search, name="geocodes-search"),
    path("geocodes/reverse/", geocode_reverse, name="geocodes-reverse"),
    # --- Geocode (単数形: レガシー。schema から除外されるハンドラに接続) ---
    path("geocode/search/", geocode_search_legacy, name="geocode-search-legacy"),
    path("geocode/reverse/", geocode_reverse_legacy, name="geocode-reverse-legacy"),
    # --- Route (単数形: レガシー) --- スタイル上は除外しつつ、POSTをRouteAPIViewへ
    path("route/", RouteAPIView.as_view(), name="route-legacy"),
    path("routes/health/", route_health, name="route_health"),
    path("", include(router.urls)),
]
