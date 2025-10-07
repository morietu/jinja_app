# backend/config/urls.py
from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView, TokenVerifyView

urlpatterns = [
    path("admin/", admin.site.urls),
    # API v1 (将来のバージョン分けに備えて prefix を固定)
    path("api/", include(("temples.api_urls", "temples"), namespace="temples")),
    path("api/", include(("users.urls", "users"), namespace="users")),
    # Auth(JWT)
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/token/verify/", TokenVerifyView.as_view(), name="token_verify"),
]
