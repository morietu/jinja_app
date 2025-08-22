# backend/temples/urls.py
from django.urls import path, include
from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from backend.temples.views import ShrineViewSet, FavoriteToggleView, RouteView, VisitCreateView
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

app_name = "temples"

router = DefaultRouter()
router.register(r"shrines", ShrineViewSet, basename="shrines")

urlpatterns = [
    path("", include(router.urls)),
    path("admin/", admin.site.urls),
    path("api/", include("temples.urls")),
    path("shrines/<int:shrine_id>/favorite/", FavoriteToggleView.as_view(), name="favorite_toggle"),
    path("shrines/<int:shrine_id>/route/", RouteView.as_view(), name="shrine_route"),
    path("shrines/<int:shrine_id>/visit/", VisitCreateView.as_view(), name="visit_create"),
    path("token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
]
