from django.urls import path
from .api.views import CurrentUserView as CurrentUserApiView  # ← API用
from .views import RegisterView, mypage  # ← HTML用ビューだけ

urlpatterns = [
    path("me/", CurrentUserApiView.as_view(), name="current-user"),
    path("register/", RegisterView.as_view(), name="register"),
    path("mypage/", mypage, name="mypage"),
]
