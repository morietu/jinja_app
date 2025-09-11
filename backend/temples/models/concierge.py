# backend/temples/models/concierge.py
from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

class ConciergeSession(models.Model):
    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

class ConciergeMessage(models.Model):
    session = models.ForeignKey(ConciergeSession, on_delete=models.CASCADE)
    role = models.CharField(max_length=10)  # "user" | "assistant"
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
