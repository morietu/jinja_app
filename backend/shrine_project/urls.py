from django.contrib import admin
from django.urls import path, include
from django.http import HttpResponse
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from temples.views_me import me

def healthz(_): return HttpResponse("ok", content_type="text/plain")

class UserMeStub(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        u = request.user
        return Response({"id": u.id, "username": u.username, "email": u.email})

urlpatterns = [
    path("__healthz", healthz),
    path("api/ping/", healthz),

    # JWT
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),

    # 一時 /api/users/me/ と /api/me/
    path("api/users/me/", UserMeStub.as_view()),
    path("api/me/", me),

    # ★ API: backend/temples/api/urls.py
    path("api/", include("temples.api.urls")),

    # ★ Web: backend/temples/urls.py
    path("", include(("temples.urls", "temples"), namespace="temples")),

    path("admin/", admin.site.urls),
]
