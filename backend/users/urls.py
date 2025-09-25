from django.urls import path

from .views_me import me

urlpatterns = [
    path("users/me/", me, name="users-me"),
]
