from django.db import models
from django.contrib.gis.db import models as gis_models  # PostGIS対応
from django.conf import settings
from django.utils import timezone


class GoriyakuTag(models.Model):
    CATEGORY_CHOICES = [
        ("ご利益", "願望・テーマ別"),
        ("神格", "祭神の種類"),
        ("地域", "地域や役割"),
    ]
    
    """ご利益タグ（マスターデータ: 固定15個）"""
    name = models.CharField(max_length=50, unique=True)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, default="ご利益")


    def __str__(self):
        return self.name


class Shrine(models.Model):
    """神社"""
    name_jp = models.CharField(max_length=100)
    name_romaji = models.CharField(max_length=100, blank=True, null=True)
    address = models.CharField(max_length=255, null=False, blank=False)
    latitude = models.FloatField(null=False)
    longitude = models.FloatField(null=False)
    location = gis_models.PointField(null=True, blank=True, srid=4326)  # PostGIS対応
    goriyaku = models.TextField(help_text="ご利益（自由メモ）", blank=True, null=True, default="")
    sajin = models.TextField(help_text="祭神", blank=True, null=True, default="")
    description = models.TextField(blank=True, null=True)  # 神社の紹介文

    # 多対多: ご利益タグ（検索用）
    goriyaku_tags = models.ManyToManyField(GoriyakuTag, related_name="shrines", blank=True)

    # 将来のAI用（五行・属性）
    element = models.CharField(max_length=10, blank=True, null=True, help_text="五行属性: 木火土金水")


    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name_jp


class Favorite(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="favorite_shrines"
    )
    shrine = models.ForeignKey(
        Shrine,
        on_delete=models.CASCADE,
        related_name="favorited_by"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "shrine")
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user} → {self.shrine}"


class Visit(models.Model):
    STATUS_CHOICES = [
        ("added", "Added"),
        ("removed", "Removed"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="visits"
    )
    shrine = models.ForeignKey(
        Shrine,
        on_delete=models.CASCADE,
        related_name="visits"
    )
    visited_at = models.DateTimeField(default=timezone.now)
    note = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="added")

    class Meta:
        ordering = ["-visited_at"]

    def __str__(self):
        return f"{self.user} @ {self.shrine} ({self.status})"


class Goshuin(models.Model):
    shrine = models.ForeignKey(Shrine, on_delete=models.CASCADE, related_name="goshuins")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    title = models.CharField(max_length=100, blank=True)
    image1 = models.ImageField(upload_to="goshuin/", blank=True, null=True)
    image2 = models.ImageField(upload_to="goshuin/", blank=True, null=True)
    image3 = models.ImageField(upload_to="goshuin/", blank=True, null=True)
    is_public = models.BooleanField(default=True)
    likes = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.shrine.name_jp} - {self.title or '御朱印'}"


class ViewLike(models.Model):
    shrine = models.ForeignKey(Shrine, on_delete=models.CASCADE, related_name="viewlikes")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    is_like = models.BooleanField(default=False)  # True=いいね, False=閲覧
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        action = "Like" if self.is_like else "View"
        return f"{self.shrine} / {self.user or 'Anonymous'} / {action}"


class RankingLog(models.Model):
    """ランキング用の集計（30日間）"""
    shrine = models.ForeignKey(Shrine, on_delete=models.CASCADE, related_name="ranking_logs")
    date = models.DateField(default=timezone.now)
    view_count = models.PositiveIntegerField(default=0)
    like_count = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ("shrine", "date")

    def __str__(self):
        return f"{self.shrine} ({self.date}): views={self.view_count}, likes={self.like_count}"

class ConciergeHistory(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="concierge_histories"
    )
    shrine = models.ForeignKey(
        "Shrine",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="recommended_histories"
    )
    reason = models.TextField()
    tags = models.JSONField(default=list, blank=True)  # ["縁結び", "恋愛運"]
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        user_str = getattr(self.user, "username", str(self.user))
        shrine_str = self.shrine.name_jp if self.shrine else "不明"
        return f"{user_str} → {shrine_str}"
    
    