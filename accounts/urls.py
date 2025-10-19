# accounts/urls.py
from django.contrib.auth import views as auth_views
from django.urls import path

from .views import MyLoginView, MyLogoutView, RegisterView, mypage

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path(
        "login/",
        MyLoginView.as_view(template_name="registration/login.html"),
        name="login",
    ),
    path("logout/", MyLogoutView.as_view(), name="logout"),
    path("mypage/", mypage, name="mypage"),
    path(
        "password_reset/", auth_views.PasswordResetView.as_view(), name="password_reset"
    ),  # ← accounts/削除
]
