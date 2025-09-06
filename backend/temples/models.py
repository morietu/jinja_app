from django.db import models
from django.contrib.gis.db import models as gis_models  # PostGIS対応
from django.conf import settings
from django.utils import timezone
from django.contrib.gis.geos import Point
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db.models import Q


class PlaceRef(models.Model):
    place_id = models.CharField(max_length=128, primary_key=True)
    name = models.CharField(max_length=255, blank=True, default="")
    address = models.CharField(max_length=255, blank=True, default="")
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    snapshot_json = models.JSONField(null=True, blank=True)
    synced_at = models.DateTimeField(null=True, blank=True, auto_now=False)

    def __str__(self):
        return self.name or self.place_id
    

    class Meta:
        db_table = "place_ref"
        indexes = [
            models.Index(fields=["name"]),
            models.Index(fields=["synced_at"]),
        ]


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
        return f"{self.name} ({self.category})"

    class Meta:
        ordering = ["category", "name"]
        indexes = [
            models.Index(fields=["category", "name"]),
        ]



class Shrine(models.Model):
    """神社"""
    name_jp = models.CharField(max_length=100)
    name_romaji = models.CharField(max_length=100, blank=True, null=True)
    address = models.CharField(max_length=255, null=False, blank=False)
    latitude  = models.FloatField(null=False,
        validators=[MinValueValidator(-90.0), MaxValueValidator(90.0)])
    longitude = models.FloatField(null=False,
        validators=[MinValueValidator(-180.0), MaxValueValidator(180.0)])
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
    
    class Meta:
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["name_jp"]),
            models.Index(fields=["updated_at"]),
        ]
    
    def save(self, *args, **kwargs):
        # lat/lng が入っているときは Point を同期（経度→x、緯度→y）
        if self.latitude is not None and self.longitude is not None:
            self.location = Point(self.longitude, self.latitude, srid=4326)
        super().save(*args, **kwargs)


class Favorite(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="favorite_shrines"
    )
    shrine = models.ForeignKey(
        Shrine,
        on_delete=models.CASCADE,
        related_name="favorited_by",
        null=True,
        blank=True
    )
    place_id = models.CharField(max_length=128, null=True, blank=True, db_index=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "shrine"],
                name="uq_favorite_user_shrine",
                condition=~Q(shrine=None),
            ),
            # place_id 運用の一意
            models.UniqueConstraint(
                fields=["user", "place_id"], name="uq_favorite_user_place",
                condition=~Q(place_id=None),
            ),
        ]
        ordering = ["-created_at"]

    def __str__(self):
        target = self.shrine.name_jp if self.shrine else (self.place_id or "?")
        return f"{self.user} → {target}"


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

    class Meta:
        indexes = [models.Index(fields=["created_at"]), models.Index(fields=["is_like"])]

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