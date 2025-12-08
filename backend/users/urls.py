# backend/users/urls.py
from django.urls import path

from .views import MeView, CurrentUserView, MeIconUploadView  # ★ ここに MeIconUploadView を入れる

app_name = "users"

urlpatterns = [
    # 既存エンドポイント
    path("users/me/", MeView.as_view(), name="users-me"),

    # 現在ログイン中ユーザー（たぶん既存）
    path("users/current/", CurrentUserView.as_view(), name="users-current"),

    # ★ プロフィールアイコンアップロード用
    path("users/me/icon/", MeIconUploadView.as_view(), name="users-me-icon"),
]
