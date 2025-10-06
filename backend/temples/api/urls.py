from django.urls import include, path
from rest_framework.routers import DefaultRouter
from temples.api.views import (
    FavoriteToggleView,
    GoriyakuTagViewSet,
    RankingAPIView,
    RouteView,
    ShrineViewSet,
    UserFavoriteListView,
    UserVisitListView,
    VisitCreateView,
)

# もし places 用のビューが別モジュールなら正しく import してください
# 例:
from temples.api.views.search import nearby_search, photo, search, text_search

app_name = "temples"

router = DefaultRouter()
router.register(r"shrines", ShrineViewSet, basename="shrine")
router.register(r"goriyaku-tags", GoriyakuTagViewSet, basename="gori-tag")

# --- 明示ビュー（Router名のハイフン問題を回避し、テストの name と合わせる） ---
shrine_list_view = ShrineViewSet.as_view({"get": "list", "post": "create"})
shrine_detail_view = ShrineViewSet.as_view(
    {"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}
)

urlpatterns = [
    # ✅ /api/shrines/ → name="shrine_list"
    path("shrines/", shrine_list_view, name="shrine_list"),
    # ✅ /api/shrines/<pk>/ → name="shrine_detail"
    path("shrines/<int:pk>/", shrine_detail_view, name="shrine_detail"),
    # ✅ /api/shrines/<pk>/route/ → name="shrine_route"
    #   ここは GET でページ、POST でAPI…など実装次第。少なくともURLとnameを用意。
    path("shrines/<int:pk>/route/", RouteView.as_view(), name="shrine_route"),
    # ✅ popular（ランキング） → name="popular-shrines"
    path("popular/", RankingAPIView.as_view(), name="popular-shrines"),
    # ✅ ルートAPI（テストは /api/route/ に POST）
    path("route/", RouteView.as_view(), name="route"),
    # ✅ Places 系（テストが直叩き）
    path("places/search/", search, name="places-search"),
    path("places/text_search/", text_search, name="places-text-search"),
    path("places/photo/", photo, name="places-photo"),
    path("places/nearby_search/", nearby_search, name="places-nearby-search"),
    # 既存のリスト等（残してOK：ブラウズ可能APIなどで便利）
    path("favorites/", UserFavoriteListView.as_view(), name="favorites-list"),
    path("favorites/toggle/", FavoriteToggleView.as_view(), name="favorites-toggle"),
    path("visits/", UserVisitListView.as_view()),
    path("visits/create/", VisitCreateView.as_view()),
    # RouterのURL（上の明示パスと競合しないので併存OK）
    path("", include(router.urls)),
    # もし nearest を使うなら（テストには直接出てないけど保持可）
    path("shrines/nearest/", ShrineViewSet.as_view({"get": "nearest"}), name="shrine-nearest"),
]
