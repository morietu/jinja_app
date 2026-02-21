# backend/temples/models_places_seeds.py
from __future__ import annotations

from django.db import models
from django.utils import timezone


class PlacesSeed(models.Model):
    """
    seeds json の各地点をDBに登録し、進捗/失敗/クールダウン等を管理する。
    seed_key が “不変ID” (upsert key)。
    """
    seed_key = models.CharField(max_length=64, primary_key=True)  # e.g. JP-13-capital
    pref_code = models.CharField(max_length=2, blank=True, default="")  # "13"
    pref = models.CharField(max_length=32, blank=True, default="")      # "東京都"
    label = models.CharField(max_length=32, blank=True, default="")     # "capital" "tourism" etc
    name = models.CharField(max_length=128, blank=True, default="")
    lat = models.FloatField()
    lng = models.FloatField()

    # optional per-seed overrides (null => use file default)
    radius_m = models.IntegerField(null=True, blank=True)
    limit = models.IntegerField(null=True, blank=True)
    keyword = models.CharField(max_length=64, blank=True, default="")

    is_active = models.BooleanField(default=True, db_index=True)

    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "places_seed"
        indexes = [
            models.Index(fields=["pref_code", "label"]),
            models.Index(fields=["is_active", "updated_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.seed_key} {self.name}"


class PlacesSeedState(models.Model):
    class Status(models.TextChoices):
        NEVER = "never", "Never"
        OK = "ok", "OK"
        FAILED = "failed", "Failed"
        SKIPPED = "skipped", "Skipped"
        RUNNING = "running", "Running"

    seed = models.OneToOneField(
        PlacesSeed,
        on_delete=models.CASCADE,
        primary_key=True,
        related_name="state",
    )

    last_run_at = models.DateTimeField(null=True, blank=True)
    last_status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.NEVER, db_index=True
    )
    last_error = models.TextField(blank=True, default="")

    last_requests_used = models.IntegerField(default=0)
    last_upserted = models.IntegerField(default=0)
    last_fetched = models.IntegerField(default=0)

    total_runs = models.IntegerField(default=0)
    total_requests_used = models.IntegerField(default=0)
    total_upserted = models.IntegerField(default=0)

    cooldown_until = models.DateTimeField(null=True, blank=True)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "places_seed_state"
        indexes = [
            models.Index(fields=["last_status", "last_run_at"]),
            models.Index(fields=["cooldown_until"]),
        ]

    def __str__(self) -> str:
        return f"{self.seed_id} {self.last_status}"
