# backend/temples/api/urls.py
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from temples import api_views_concierge as concierge

from .views.concierge_history import ConciergeHistoryView
from .views.favorite import FavoriteToggleView, UserFavoriteListView
from .views.search import detail, nearby_search, photo, search, text_search
from .views.shrine import RankingAPIView, ShrineViewSet
from .views.visit import UserVisitListView, VisitCreateView  # ← これだけでOK

app_name = "temples"

router = DefaultRouter()
router.register(r"shrines", ShrineViewSet, basename="shrine")

urlpatterns = [
    # Concierge（AIナビ）
    path("concierge/chat/", concierge.chat, name="concierge-chat"),
    path("concierge/plan/", concierge.ConciergePlanView.as_view(), name="concierge-plan"),
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
    # Shrines: ViewSet の標準エンドポイントに加えて、nearest アクション用の明示パス
    path("shrines/nearest/", ShrineViewSet.as_view({"get": "nearest"}), name="shrine-nearest"),
    # DRF router（/api/shrines/...）
    path("", include(router.urls)),
]
