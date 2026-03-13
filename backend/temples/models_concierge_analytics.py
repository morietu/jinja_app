# backend/temples/models_concierge_analytics.py
from django.conf import settings
from django.db import models


class ConciergeRecommendationLog(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="concierge_recommendation_logs",
    )
    thread = models.ForeignKey(
        "temples.ConciergeThread",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="recommendation_logs",
    )

    query = models.TextField(blank=True, default="")
    need_tags = models.JSONField(default=list, blank=True)

    flow = models.CharField(max_length=8, blank=True, default="")
    llm_enabled = models.BooleanField(default=False)
    llm_used = models.BooleanField(default=False)

    recommendations = models.JSONField(default=list, blank=True)
    result_state = models.JSONField(default=dict, blank=True)

    lat = models.FloatField(null=True, blank=True)
    lng = models.FloatField(null=True, blank=True)
    radius_m = models.IntegerField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "temples_concierge_recommendation_log"
        ordering = ["-created_at"]

class ConciergeRecommendationClickLog(models.Model):
    recommendation_log = models.ForeignKey(
        "temples.ConciergeRecommendationLog",
        on_delete=models.CASCADE,
        related_name="click_logs",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="concierge_recommendation_click_logs",
    )
    thread = models.ForeignKey(
        "temples.ConciergeThread",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="recommendation_click_logs",
    )

    shrine_id = models.IntegerField(null=True, blank=True)
    place_id = models.CharField(max_length=255, blank=True, default="")
    rank = models.IntegerField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "temples_concierge_recommendation_click_log"
        ordering = ["-created_at"]
