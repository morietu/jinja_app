# backend/shrine_project/urls.py
from django.contrib import admin
from django.urls import path, include
from django.http import HttpResponse, JsonResponse
from temples.views_me import me


# ヘルス
def healthz(_): return HttpResponse("ok", content_type="text/plain")

# JWTで叩ける /api/users/me/ の一時スタブ（後でtemples実装に置換）
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

class UserMeStub(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        u = request.user
        return Response({"id": u.id, "username": u.username, "email": u.email})

from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path("__healthz", healthz),
    path("api/ping/", healthz),

    path("api/users/me/", UserMeStub.as_view()),

    # ★ JWT
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),

    path("admin/", admin.site.urls),
    path("api/me/", me),

]

# temples.api.urls は安全に取り込む（失敗時は理由を可視化）
try:
    urlpatterns += [path("api/", include("temples.api.urls"))]
except Exception as e:
    def import_error(_):
        return JsonResponse({"error": "failed to import temples.api.urls",
                             "detail": str(e)}, status=500)
    urlpatterns += [path("api/__import_error__", import_error)]
from temples.views_me import me

urlpatterns += [
    path("api/me/", me),
]
from temples.views_me import me

urlpatterns += [
    path("api/me/", me),
]
