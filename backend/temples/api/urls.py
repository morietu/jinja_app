# backend/temples/api/urls.py
from django.urls import path
from temples import api_views_concierge as concierge

from .views.concierge_history import ConciergeHistoryView

app_name = "temples"

urlpatterns = [
    # Concierge（AIナビ）だけ残す
    path("concierge/chat/", concierge.chat, name="concierge-chat"),
    path("concierge/plan/", concierge.ConciergePlanView.as_view(), name="concierge-plan"),
    path("concierge/history/", ConciergeHistoryView.as_view(), name="concierge-history"),
]
