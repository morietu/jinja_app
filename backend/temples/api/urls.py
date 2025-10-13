# backend/temples/api/urls.py  （= /app/temples/api/urls.py）
from django.http import Http404
from django.urls import include, path
from rest_framework.routers import DefaultRouter

# concierge は既存の関数ビューを使う
from temples import api_views_concierge as concierge

from .views.concierge_history import ConciergeHistoryView
from .views.favorite import FavoriteToggleView, UserFavoriteListView
from .views.geocode import GeocodeReverseView, GeocodeSearchView
from .views.route import RouteAPIView, RouteView
from .views.search import detail, nearby_search, photo, search, text_search
from .views.shrine import RankingAPIView, ShrineViewSet
from .views.visit import UserVisitListView, VisitCreateView

app_name = "temples"

router = DefaultRouter()
router.register(r"shrines", ShrineViewSet, basename="shrine")


# ★ 非オーナーは 404（今回の要件では常に 404 でOK）
def _blocked_shrine_detail(request, pk: int, *args, **kwargs):
    raise Http404()


urlpatterns = [
    # Route API (JSON) と Route ページ(HTML)
    path("route/", RouteAPIView.as_view(), name="route"),
    path("shrines/<int:pk>/route/", RouteView.as_view(), name="shrine_route"),
    # Shrines 明示の list / detail
    path("shrines/", ShrineViewSet.as_view({"get": "list"}), name="shrine_list"),
    # ↓↓↓ ここを retrieve から「常に404」に差し替え（順序は router より先！）
    path("shrines/<int:pk>/", _blocked_shrine_detail, name="shrine_detail"),
    path("shrines/nearest/", ShrineViewSet.as_view({"get": "nearest"}), name="shrine-nearest"),
    # Concierge（api_views_concierge 由来）
    path("concierge/chat/", concierge.chat, name="concierge-chat"),
    path("concierge/plan/", concierge.plan, name="concierge-plan"),
    path("concierge/history/", ConciergeHistoryView.as_view(), name="concierge-history"),
    # ランキング
    path("popular/", RankingAPIView.as_view(), name="popular-shrines"),
    # Places
    path("places/search/", search, name="places-search"),
    path("places/text_search/", text_search, name="places-text-search"),
    path("places/photo/", photo, name="places-photo"),
    path("places/nearby_search/", nearby_search, name="places-nearby-search"),
    path("places/<str:place_id>/", detail, name="places-detail"),
    # Favorites / Visits（要JWT）
    path("favorites/", UserFavoriteListView.as_view(), name="favorites-list"),
    path("favorites/toggle/", FavoriteToggleView.as_view(), name="favorites-toggle"),
    path("visits/", UserVisitListView.as_view(), name="visits-list"),
    path("visits/create/", VisitCreateView.as_view(), name="visits-create"),
    path("visits/create/<int:shrine_id>/", VisitCreateView.as_view(), name="visits-create-with-id"),
    path("geocode/search/", GeocodeSearchView.as_view()),
    path("geocode/reverse/", GeocodeReverseView.as_view()),
    # Router の標準（上の明示と競合しない）
    path("", include(router.urls)),
]
