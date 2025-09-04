from django.urls import path
from .api.views import CurrentUserView as CurrentUserApiView  # ← API用
from .views import RegisterView, mypage  # ← HTML用ビューだけ
from rest_framework_simplejwt.views import (
    TokenObtainPairView, TokenRefreshView, TokenVerifyView
)

app_name = "users"


urlpatterns = [
    path("me/", CurrentUserApiView.as_view(), name="current-user"),
    path("register/", RegisterView.as_view(), name="register"),
    path("mypage/", mypage, name="mypage"),
    path("token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("token/verify/", TokenVerifyView.as_view(), name="token_verify"),

]
