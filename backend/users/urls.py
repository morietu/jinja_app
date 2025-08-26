from django.urls import path
from .api.views import CurrentUserView   # ✅ API用
from .views import RegisterView, mypage  # ✅ HTML用ビューのみ

urlpatterns = [
    path("me/", CurrentUserView.as_view(), name="current-user"),
    path("register/", RegisterView.as_view(), name="register"),
    path("mypage/", mypage, name="mypage"),
]
