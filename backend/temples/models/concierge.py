# backend/temples/models/concierge.py
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import models

User = get_user_model()


class ConciergeSession(models.Model):
    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)


class ConciergeMessage(models.Model):
    session = models.ForeignKey(ConciergeSession, on_delete=models.CASCADE)
    role = models.CharField(max_length=10)  # "user" | "assistant"
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)


class ConciergeHistory(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="concierge_histories"
    )
    query = models.TextField()
    response = models.JSONField(null=True, blank=True)
    meta = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
