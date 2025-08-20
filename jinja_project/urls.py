# jinja_project/urls.py
from django.contrib import admin
from django.urls import path, include
from django.views.generic import TemplateView, RedirectView
from django.contrib.auth import views as auth_views
from django.contrib.auth import get_user_model
from temples.models import Shrine, Visit

from django.http import HttpResponse
from django.urls import re_path

def _devtools_stub(_request):
    # 204 No Content を返してChromeを黙らせる
    return HttpResponse("", status=204)

User = get_user_model()
u = User.objects.get(username="admin")          # 管理者ユーザー
s = Shrine.objects.first()                      # 既存の神社1件
Visit.objects.create(user=u, shrine=s, note="初回参拝")

from accounts.views import MyLoginView, mypage  # RegisterViewは未使用なら省略可

urlpatterns = [
    path("admin/", admin.site.urls),

    # アカウント系
    path("accounts/", include("accounts.urls")),
    path("login/", MyLoginView.as_view(template_name="registration/login.html"), name="login"),
    path("logout/", auth_views.LogoutView.as_view(), name="logout"),
    path("mypage/", mypage, name="mypage"),

    # 神社機能は /shrines/ に一本化（namespaceは“temples”のままでOK）
    path("shrines/", include(("temples.urls", "temples"), namespace="temples")),

    # 互換: /temples/→/shrines/（完全削除したいなら下2行を消す）
    path("temples/<path:rest>/", RedirectView.as_view(url="/shrines/%(rest)s", permanent=True)),
    path("temples/", RedirectView.as_view(url="/shrines/", permanent=True)),

    # Home
    path("", TemplateView.as_view(template_name="home.html"), name="home"),

    # パスワードリセット（4画面）
    path("password_reset/", auth_views.PasswordResetView.as_view(
        template_name="accounts/password_reset_form.html",
        email_template_name="accounts/password_reset_email.txt",
        subject_template_name="accounts/password_reset_subject.txt",
    ), name="password_reset"),
    path("password_reset/done/", auth_views.PasswordResetDoneView.as_view(
        template_name="accounts/password_reset_done.html",
    ), name="password_reset_done"),
    path("reset/<uidb64>/<token>/", auth_views.PasswordResetConfirmView.as_view(
        template_name="accounts/password_reset_confirm.html",
    ), name="password_reset_confirm"),
    path("reset/done/", auth_views.PasswordResetCompleteView.as_view(
        template_name="accounts/password_reset_complete.html",
    ), name="password_reset_complete"),
     re_path(r'^\.well-known/appspecific/com\.chrome\.devtools\.json$', _devtools_stub),
]