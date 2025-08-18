from django.urls import path
from .views import ShrineListView, ShrineDetailView, shrine_route, favorite_toggle
from . import views


app_name = "temples"

urlpatterns = [
    path("", views.ShrineListView.as_view(), name="shrine_list"),
    path("<int:pk>/", views.ShrineDetailView.as_view(), name="shrine_detail"),
    path("<int:pk>/route/", views.shrine_route, name="shrine_route"),
    path("<int:pk>/favorite/", views.favorite_toggle, name="favorite_toggle"),  # ← これ
]
