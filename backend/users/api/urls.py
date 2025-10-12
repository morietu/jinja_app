from django.urls import path

from .views import MeView, SignupView

urlpatterns = [
    path("users/me/", MeView.as_view(), name="users-me"),
    path("users/signup/", SignupView.as_view(), name="users-signup"),
]
