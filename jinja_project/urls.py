from django.contrib import admin
from django.urls import path, include
from django.views.generic import TemplateView, RedirectView
from django.contrib.auth import views as auth_views

from accounts.views import RegisterView, MyLoginView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("accounts/", include("accounts.urls")),
    path("shrines/", include("temples.urls", namespace="temples")),
    path("", include("accounts.urls")),
    path("<int:pk>/", RedirectView.as_view(pattern_name="temples:detail", permanent=False)),

    # Home は 1つだけ
    path("", TemplateView.as_view(template_name="home.html"), name="home"),
    path("login/", MyLoginView.as_view(template_name="accounts/login.html"), name="login"),




    # 認証
    # path("accounts/login/", auth_views.LoginView.as_view(template_name="accounts/login.html"), name="login"),
    # path("accounts/logout/", auth_views.LogoutView.as_view(), name="logout"),
    # path("accounts/register/", RegisterView.as_view(), name="register"),

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
]
