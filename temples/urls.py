from django.urls import path
from .views import ShrineListView, ShrineDetailView, shrine_route, favorite_toggle

urlpatterns = [
    path("", ShrineListView.as_view(), name="shrine_list"),
    path("<int:pk>/", ShrineDetailView.as_view(), name="shrine_detail"),
    path("<int:pk>/route/", shrine_route, name="shrine_route"),
    path("<int:pk>/favorite/", favorite_toggle, name="shrine_favorite_toggle"),  # ← これ
]
