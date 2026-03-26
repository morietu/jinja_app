from __future__ import annotations

from django.conf import settings
from django.db import models
from django.db.models import Q


class FeatureUsage(models.Model):
    class Scope(models.TextChoices):
        ANONYMOUS = "anonymous", "Anonymous"
        USER = "user", "User"

    class Feature(models.TextChoices):
        CONCIERGE = "concierge", "Concierge"
        FAVORITE = "favorite", "Favorite"
        GOSHUIN_UPLOAD = "goshuin_upload", "Goshuin Upload"

    scope = models.CharField(max_length=16, choices=Scope.choices)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="feature_usages",
    )
    anon_id = models.CharField(max_length=64, blank=True, default="", db_index=True)

    feature = models.CharField(max_length=32, choices=Feature.choices)
    count = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["scope", "feature"]),
            models.Index(fields=["user", "feature"]),
            models.Index(fields=["anon_id", "feature"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "feature"],
                condition=Q(scope="user") & Q(user__isnull=False),
                name="uq_feature_usage_user_feature",
            ),
            models.UniqueConstraint(
                fields=["anon_id", "feature"],
                condition=Q(scope="anonymous") & Q(anon_id__gt=""),
                name="uq_feature_usage_anon_feature",
            ),
            models.CheckConstraint(
                condition=(
                    (Q(scope="user") & Q(user__isnull=False) & Q(anon_id=""))
                    | (Q(scope="anonymous") & Q(user__isnull=True) & Q(anon_id__gt=""))
                ),
                name="chk_feature_usage_scope_target",
            ),
        ]

    def __str__(self) -> str:
        target = self.user_id or self.anon_id
        return f"{self.scope}:{target}:{self.feature}={self.count}"
