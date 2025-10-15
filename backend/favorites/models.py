from django.conf import settings
from django.db import models


class Favorite(models.Model):
    TARGET_CHOICES = (("shrine", "Shrine"),)

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="favorites"
    )
    target_type = models.CharField(max_length=20, choices=TARGET_CHOICES)
    target_id = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "target_type", "target_id"],
                name="uniq_favorite_per_user_and_target",
            )
        ]

    def __str__(self):
        return f"{self.user_id}:{self.target_type}:{self.target_id}"
