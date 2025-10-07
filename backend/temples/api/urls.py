# backend/temples/api/urls.py
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from temples import api_views_concierge as concierge

# HTMLビュー / APIビューは temples.views から1回だけ import
from temples.views import RouteAPIView, ShrineDetailView, ShrineRouteView

from .views import (
    FavoriteToggleView,
    UserFavoriteListView,
    UserVisitListView,
    VisitCreateView,
)

# places 検索系
from .views.search import detail, nearby_search, photo, search, text_search

# ---- ViewSets / APIView の正しい所在に統一して import ----
from .views.shrine import GoriyakuTagViewSet, RankingAPIView, ShrineViewSet

app_name = "temples"

# ---- Router登録（ブラウザブルAPI用。明示URLとも競合しない）----
router = DefaultRouter()
router.register(r"shrines", ShrineViewSet, basename="shrine")
router.register(r"goriyaku-tags", GoriyakuTagViewSet, basename="gori-tag")

# ---- 明示的な名前付きビュー（テストが name を期待しているため）----
shrine_list_view = ShrineViewSet.as_view({"get": "list"})
shrine_detail_view = ShrineDetailView.as_view()  # ← 所有者チェックありに差し替え
shrine_nearest_view = ShrineViewSet.as_view({"get": "nearest"})

urlpatterns = [
    # Shrines
    path("shrines/", shrine_list_view, name="shrine_list"),
    path("shrines/<int:pk>/", shrine_detail_view, name="shrine_detail"),
    # HTML のルート画面（ログイン必須）
    path("shrines/<int:pk>/route/", ShrineRouteView.as_view(), name="shrine_route"),
    # 近場検索（ViewSet のカスタムアクション）
    path("shrines/nearest/", shrine_nearest_view, name="shrine-nearest"),
    # ランキング
    path("popular/", RankingAPIView.as_view(), name="popular-shrines"),
    # ルートAPI（JSON）
    path("route/", RouteAPIView.as_view(), name="route"),
    # Places
    path("places/search/", search, name="places-search"),
    path("places/text_search/", text_search, name="places-text-search"),
    path("places/photo/", photo, name="places-photo"),
    path("places/nearby_search/", nearby_search, name="places-nearby-search"),
    path("places/<str:place_id>/", detail, name="places-detail"),
    # Favorites / Visits
    path("favorites/", UserFavoriteListView.as_view(), name="favorites-list"),
    path("favorites/toggle/", FavoriteToggleView.as_view(), name="favorites-toggle"),
    path("visits/", UserVisitListView.as_view(), name="visits-list"),
    path("visits/create/", VisitCreateView.as_view(), name="visits-create"),
    # Concierge（AIナビ）
    path("concierge/chat/", concierge.chat, name="concierge-chat"),
    path("concierge/plan/", concierge.ConciergePlanView.as_view(), name="concierge-plan"),
    # Router 由来
    path("", include(router.urls)),
]
