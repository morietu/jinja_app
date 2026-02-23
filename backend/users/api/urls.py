from django.urls import path
from . import views

urlpatterns = [
    path("users/me/", views.MeView.as_view(), name="me"),
    path("users/me/storage/", views.MeStorageView.as_view(), name="me-storage"),
    path("users/signup/", views.SignupView.as_view(), name="signup"),
    path("stripe/webhook/", views.stripe_webhook, name="stripe-webhook"),
]
