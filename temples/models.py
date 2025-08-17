from django.db import models
from django.conf import settings

class Shrine(models.Model):
    name = models.CharField(max_length=200)
    prefecture = models.CharField(max_length=50)
    address = models.CharField(max_length=255)
    built_year = models.IntegerField(null=True, blank=True)  # ← founded_year を神社寄りの名前に
    enshrined_kami = models.CharField(max_length=200, blank=True, help_text="祭神（例: 天照大神）")
    benefits = models.CharField(max_length=255, blank=True, help_text="ご利益（カンマ区切り）")
    lat = models.FloatField(null=True, blank=True)
    lng = models.FloatField(null=True, blank=True)

    def __str__(self):
        return self.name
    class Meta:
        ordering = ["name"]


class Favorite(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="favorite_shrines"
    )
    shrine = models.ForeignKey(
        "Shrine",
        on_delete=models.CASCADE,
        related_name="favorited_by"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "shrine")
        # ★ここがポイント：Favoriteの並びは作成日の新しい順
        ordering = ["-created_at"]

    
    def __str__(self):
        return f"{self.user} → {self.shrine}"

   
