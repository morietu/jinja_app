from django.db import models
from django.conf import settings

class Shrine(models.Model):
    name = models.CharField(max_length=200)
    prefecture = models.CharField(max_length=50, blank=True)
    city = models.CharField(max_length=100, blank=True)
    address = models.CharField(max_length=255, blank=True)
    built_year = models.IntegerField(null=True, blank=True)  # ← founded_year を神社寄りの名前に
    enshrined_kami = models.CharField(max_length=200, blank=True, help_text="祭神（例: 天照大神）")
    benefits = models.CharField(max_length=255, blank=True, help_text="ご利益（カンマ区切り）")
    lat = models.FloatField(null=True, blank=True)
    lng = models.FloatField(null=True, blank=True)


    # ★追加：所有者（一般ユーザーは自分の神社だけ見える/触れる）
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="shrines",
        null=True,
        blank=True,   # 既存データを壊さないため一旦許可（後で必須化OK）
    )

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

 