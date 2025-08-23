# apps/temples/api/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ShrineViewSet,
    FavoriteToggleView,
    RouteView,
    VisitCreateView,
    GoriyakuTagViewSet,   # ← 追加
)

router = DefaultRouter()
router.register(r"shrines", ShrineViewSet, basename="shrine")
router.register(r"goriyaku-tags", GoriyakuTagViewSet, basename="goriyaku-tags")


urlpatterns = [
    path("", include(router.urls)),
    path("shrines/<int:shrine_id>/favorite/", FavoriteToggleView.as_view(), name="favorite-toggle"),
    path("route/", RouteView.as_view(), name="route"),
    path("shrines/<int:shrine_id>/visit/", VisitCreateView.as_view(), name="visit-create"),
    
]
