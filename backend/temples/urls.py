from django.urls import path
from . import views

app_name = "temples"

urlpatterns = [
    path("shrines/", views.shrine_list, name="shrine_list"),
    path("shrines/<int:pk>/", views.shrine_detail, name="shrine_detail"),
    path("shrines/<int:pk>/route/", views.shrine_route, name="shrine_route"),
    path("shrines/<int:pk>/favorite/", views.favorite_toggle, name="favorite_toggle"),
]
