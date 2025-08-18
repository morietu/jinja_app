# accounts/urls.py
from django.urls import path
from django.contrib.auth import views as auth_views
from .views import RegisterView, mypage

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/",  auth_views.LoginView.as_view(),  name="login"),   # ← 指定不要
    path("logout/", auth_views.LogoutView.as_view(), name="logout"),
    path("mypage/", mypage, name="mypage"),
    path("password_reset/", auth_views.PasswordResetView.as_view(), name="password_reset"),  # ← accounts/削除
]
