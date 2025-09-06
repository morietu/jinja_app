from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views
from .api_views import FavoriteViewSet, ShrineViewSet
from .views import RouteView

router = DefaultRouter()
router.register(r"favorites", FavoriteViewSet, basename="favorite")
router.register(r"shrines", ShrineViewSet, basename="shrine")

app_name = "temples"

urlpatterns = [
    # ✅ テスト互換: /api/shrines/ に name='shrine_list' を付与
    #   これが reverse('temples:shrine_list') の解決先になる
    path(
        "shrines/",
        ShrineViewSet.as_view({"get": "list"}),
        name="shrine_list",
    ),

    # ルーターの自動生成ルート（/api/shrines/ など）も残す
    path("", include(router.urls)),

    # ルートAPI
    path("route/", RouteView.as_view(), name="route"),

    # HTMLビュー（name 衝突を避けるため _page に改名）
    path("pages/shrines/", views.shrine_list, name="shrine_list_page"),

    path("pages/shrines/<int:pk>/route/", views.shrine_route, name="shrine_route"),
    path("pages/shrines/<int:pk>/route/", views.shrine_route, name="shrine_route_page"),

    path("pages/shrines/<int:pk>/", views.shrine_detail, name="shrine_detail"),
    path("pages/shrines/<int:pk>/favorite/", views.favorite_toggle, name="favorite_toggle"),


]
