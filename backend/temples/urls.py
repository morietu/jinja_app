from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views
from .api_views import FavoriteViewSet, ShrineViewSet  # ← ShrineViewSet を忘れず import
from .views import RouteView

router = DefaultRouter()
router.register(r"favorites", FavoriteViewSet, basename="favorite")
router.register(r"shrines", ShrineViewSet, basename="shrine")

app_name = "temples"

urlpatterns = [
    # ✅ API（/api/shrines/, /api/favorites/）
    path("", include(router.urls)),

    # ✅ ルートAPI（POST /api/route/）
    path("route/", RouteView.as_view(), name="route"),

    # ✅ HTMLビューは /api/pages/shrines/ 以下（必要な場合のみ残す）
    path("pages/shrines/", views.shrine_list, name="shrine_list"),
    path("pages/shrines/<int:pk>/", views.shrine_detail, name="shrine_detail"),
    path("pages/shrines/<int:pk>/route/", views.shrine_route, name="shrine_route"),
    path("pages/shrines/<int:pk>/favorite/", views.favorite_toggle, name="favorite_toggle"),
]
