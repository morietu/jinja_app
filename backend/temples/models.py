

from django.conf import settings
from django.utils import timezone

from django.contrib.postgres.indexes import GistIndex, GinIndex

from django.core.validators import MinValueValidator, MaxValueValidator
from django.db.models import Q, CheckConstraint




GIS_ENABLED = bool(getattr(settings, "USE_GIS", False))

if GIS_ENABLED:
    # 本番/コンテナなど（PostGIS+GDALがある環境）
    from django.contrib.gis.db import models as models
    try:
        from django.contrib.gis.geos import Point  # 使っていれば利用可
    except Exception:
        Point = None
else:
    # ローカル開発（GISなし）
    from django.db import models as models

    # 既存コードが Point(x, y) を呼んでも落ちないような簡易ダミー
    class Point(tuple):
        def __new__(cls, x, y): return super().__new__(cls, (x, y))
        @property
        def x(self): return self[0]
        @property
        def y(self): return self[1]

    # もし models.PointField を使っていた場合の簡易代替
    class PointField(models.JSONField):
        pass

class PlaceRef(models.Model):
    place_id = models.CharField(max_length=128, primary_key=True)
    name = models.CharField(max_length=255, blank=True, default="")
    address = models.CharField(max_length=255, blank=True, default="")
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    snapshot_json = models.JSONField(null=True, blank=True)
    synced_at = models.DateTimeField(null=True, blank=True, auto_now=False)

    def __str__(self) -> str:
        return self.name or self.place_id

    class Meta:
        db_table = "place_ref"
        indexes = [
            models.Index(fields=["name"]),
            models.Index(fields=["synced_at"]),
            GinIndex(fields=["snapshot_json"], name="placeref_snapshot_gin"),
        ]


class GoriyakuTag(models.Model):
    """ご利益タグ（マスターデータ）"""

    CATEGORY_CHOICES = [
        ("ご利益", "願望・テーマ別"),
        ("神格", "祭神の種類"),
        ("地域", "地域や役割"),
    ]

    name = models.CharField(max_length=50, unique=True)
    category = models.CharField(
        max_length=50, choices=CATEGORY_CHOICES, default="ご利益"
    )

    def __str__(self) -> str:
        return f"{self.name} ({self.category})"

    class Meta:
        ordering = ["category", "name"]
        indexes = [
            models.Index(fields=["category", "name"]),
        ]


class Shrine(models.Model):
    """神社"""

    # 基本情報
    name_jp = models.CharField(max_length=100)
    name_romaji = models.CharField(max_length=100, blank=True, null=True)
    address = models.CharField(max_length=255)

    # 位置情報
    latitude = models.FloatField(
        validators=[MinValueValidator(-90.0), MaxValueValidator(90.0)]
    )
    longitude = models.FloatField(
        validators=[MinValueValidator(-180.0), MaxValueValidator(180.0)]
    )
if GIS_ENABLED:
    location = models.PointField(srid=4326, null=True, blank=True)  # 経度(x), 緯度(y)
else:
    # ローカル（GISなし）は JSON に lng/lat を格納
    location = models.JSONField(null=True, blank=True)  # {"lng": x, "lat": y}

    # ご利益・祭神など
    goriyaku = models.TextField(
        help_text="ご利益（自由メモ）", blank=True, null=True, default=""
    )
    sajin = models.TextField(help_text="祭神", blank=True, null=True, default="")
    description = models.TextField(blank=True, null=True)

    # 多対多: ご利益タグ（検索用）
    goriyaku_tags = models.ManyToManyField(
        "GoriyakuTag", related_name="shrines", blank=True
    )

    # 将来のAI用（五行・属性）
    element = models.CharField(
        max_length=10, blank=True, null=True, help_text="五行属性: 木火土金水"
    )

    # タイムスタンプ
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    # 人気集計（直近30日）
    views_30d = models.PositiveIntegerField(default=0)
    favorites_30d = models.PositiveIntegerField(default=0)
    popular_score = models.FloatField(default=0.0)
    last_popular_calc_at = models.DateTimeField(null=True, blank=True)

    def __str__(self) -> str:
        return self.name_jp

    class Meta:
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["name_jp"]),
            models.Index(fields=["updated_at"]),
            # 人気順の高速化（descはB-Treeで表現できないためクエリでORDER BY DESC、
            # ここでは並び替えに寄与する一般Indexを付与）
            models.Index(fields=["popular_score"], name="shrine_popular_idx"),
            # PointField の spatial_index=True で自動作成されるため省略可
            GistIndex(fields=["location"], name="shrine_location_gist"),
            models.Index(fields=['latitude'], name='idx_shrine_lat'),
            models.Index(fields=['longitude'], name='idx_shrine_lng'),
            models.Index(fields=['latitude', 'longitude'], name='idx_shrine_lat_lng'),
        ]

    def save(self, *args, **kwargs):
        if self.latitude is not None and self.longitude is not None:
            self.location = Point(self.longitude, self.latitude, srid=4326)
        else:
            self.location = None
        super().save(*args, **kwargs)


class Favorite(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="favorite_shrines",
    )
    # Shrine ベース（互換）
    shrine = models.ForeignKey(
        Shrine,
        on_delete=models.CASCADE,
        related_name="favorited_by",
        null=True,
        blank=True,
    )
    # Places ベース
    place_id = models.CharField(max_length=128, null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ["-created_at"]
        constraints = [
            # 片方だけ必須（XOR）
            models.CheckConstraint(
                name="favorite_exactly_one_target",
                check=(
                    (Q(shrine__isnull=False) & Q(place_id__isnull=True))
                    | (Q(shrine__isnull=True) & Q(place_id__isnull=False))
                ),
            ),
            # user × shrine を一意（shrine がある場合のみ）
            models.UniqueConstraint(
                fields=["user", "shrine"],
                name="uq_favorite_user_shrine",
                condition=Q(shrine__isnull=False),
            ),
            # user × place_id を一意（place_id がある場合のみ）
            models.UniqueConstraint(
                fields=["user", "place_id"],
                name="uq_favorite_user_place",
                condition=Q(place_id__isnull=False),
            ),
        ]

    def __str__(self) -> str:
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
        related_name="visits",
    )
    shrine = models.ForeignKey(
        Shrine,
        on_delete=models.CASCADE,
        related_name="visits",
    )
    visited_at = models.DateTimeField(default=timezone.now)
    note = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="added")

    class Meta:
        ordering = ["-visited_at"]

    def __str__(self) -> str:
        return f"{self.user} @ {self.shrine} ({self.status})"


class Goshuin(models.Model):
    shrine = models.ForeignKey(
        Shrine, on_delete=models.CASCADE, related_name="goshuins"
    )
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    title = models.CharField(max_length=100, blank=True)
    is_public = models.BooleanField(default=True)
    likes = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)


class GoshuinImage(models.Model):
    goshuin = models.ForeignKey(
        Goshuin, on_delete=models.CASCADE, related_name="images"
    )
    image = models.ImageField(upload_to="goshuin/")
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]
        indexes = [models.Index(fields=["order"])]

    def __str__(self) -> str:
        g = self.goshuin
        shrine_name = getattr(getattr(g, "shrine", None), "name_jp", "不明")
        title = getattr(g, "title", "") or "御朱印"
        return f"{shrine_name} - {title}"


class Like(models.Model):
    shrine = models.ForeignKey(Shrine, on_delete=models.CASCADE, related_name="likes")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["shrine", "user"], name="uq_like_shrine_user"
            )
        ]

    def __str__(self) -> str:
        # is_like フラグは無いので固定表示
        return f"Like: {self.shrine} / {self.user or 'Anonymous'}"


class RankingLog(models.Model):
    """ランキング用の集計（30日間）"""

    shrine = models.ForeignKey(
        Shrine, on_delete=models.CASCADE, related_name="ranking_logs"
    )
    date = models.DateField(default=timezone.localdate)
    view_count = models.PositiveIntegerField(default=0)
    like_count = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["shrine", "date"], name="uq_rankinglog_shrine_date"
            )
        ]

    def __str__(self) -> str:
        return f"{self.shrine} ({self.date}): views={self.view_count}, likes={self.like_count}"


class ConciergeHistory(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="concierge_histories",
    )
    shrine = models.ForeignKey(
        Shrine,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="recommended_histories",
    )
    reason = models.TextField()
    tags = models.JSONField(default=list, blank=True)  # 例: ["縁結び", "恋愛運"]
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        user_str = getattr(self.user, "username", str(self.user))
        shrine_str = self.shrine.name_jp if self.shrine else "不明"
        return f"{user_str} → {shrine_str}"
