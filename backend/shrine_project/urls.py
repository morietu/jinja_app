# backend/shrine_project/urls.py
from django.urls import path, include
from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from temples.api.views import ShrineViewSet, FavoriteToggleView, RouteView, VisitCreateView
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

app_name = "temples"

router = DefaultRouter()
router.register(r"shrines", ShrineViewSet, basename="shrines")

urlpatterns = [
    path("admin/", admin.site.urls),

    # shrines API
    path("api/", include(router.urls)),                  # /api/shrines/
    path("api/", include("temples.urls")),               # /api/ranking/ 等
    path("api/shrines/<int:shrine_id>/favorite/", FavoriteToggleView.as_view(), name="favorite_toggle"),
    path("api/shrines/<int:shrine_id>/route/", RouteView.as_view(), name="shrine_route"),
    path("api/shrines/<int:shrine_id>/visit/", VisitCreateView.as_view(), name="visit_create"),
    path("api/users/", include("users.urls")),

    # users API
    path("users/", include("users.urls")),

    # auth
    path("token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
]

