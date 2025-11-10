from django.conf import settings
from django.contrib.postgres.indexes import GinIndex
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models as dj_models
from django.db.models import CheckConstraint, Q, UniqueConstraint
from django.utils import timezone

# GeoDjangoを使うのは USE_GIS が真 かつ テスト無効化フラグが立っていないときだけ
USE_REAL_GIS = bool(getattr(settings, "USE_GIS", False)) and not bool(
    getattr(settings, "DISABLE_GIS_FOR_TESTS", False)
)
if USE_REAL_GIS:
    from django.contrib.gis.db import models as models  # type: ignore
    from django.contrib.gis.geos import Point  # 実GIS時のみ
else:
    models = dj_models  # type: ignore
    Point = None

# --- PointField を環境に応じて差し替える shim -------------------------------
# GIS を使うときだけ本物の PointField を、テスト(SQLite)では安全な JSON/Text に置換
USE_REAL_GIS = bool(getattr(settings, "USE_GIS", False)) and not bool(
    getattr(settings, "DISABLE_GIS_FOR_TESTS", False)
)

if USE_REAL_GIS:
    from django.contrib.gis.db.models import PointField as _RealPointField

    PointFieldBase = _RealPointField
else:
    # 非GIS環境では JSONField（または TextField）にフォールバック
    # 既存コードの引数互換性のため **kwargs 受け取り＆無視
    class PointFieldBase(dj_models.JSONField):
        def __init__(self, *args, srid=None, geography=None, spatial_index=None, **kwargs):
            # srid 等は無視。NULL/BLANK 指定はそのまま通す
            super().__init__(*args, **kwargs)


# 以降、この PointFieldBase を PointField として使う
class PointField(PointFieldBase):
    def deconstruct(self):
        name, path, args, kwargs = super().deconstruct()
        # ✅ 実行環境に合わせて正しい型パスを返す
        from django.conf import settings as _s

        use_real_gis = bool(getattr(_s, "USE_GIS", False)) and not bool(
            getattr(_s, "DISABLE_GIS_FOR_TESTS", False)
        )
        if use_real_gis:
            path = "django.contrib.gis.db.models.fields.PointField"
            # GIS 特有の引数は kwargs に残してOK
        else:
            path = "django.db.models.JSONField"
            # 非GISでは無意味な引数を削除
            for k in ("srid", "geography", "spatial_index"):
                kwargs.pop(k, None)

        for k in ("geography", "spatial_index"):
            kwargs.pop(k, None)
        return name, path, args, kwargs


def _loc_changed(old, new):
    # どちらかが None → 変化あり/なしを厳密に
    if old is None or new is None:
        return (old is None) != (new is None)

    def to_xy(v):
        # GEOS Point（import せずに反射で判定）
        if hasattr(v, "x") and hasattr(v, "y"):
            try:
                return (float(v.x), float(v.y))
            except Exception:
                return None
        if isinstance(v, dict) and "coordinates" in v:
            # GeoJSON: [lon, lat]
            coords = v["coordinates"]
            return (float(coords[0]), float(coords[1]))
        # それ以外の未知型は「変化あり」扱いにする
        return None

    old_xy = to_xy(old)
    new_xy = to_xy(new)
    if old_xy is None or new_xy is None:
        return True
    return old_xy != new_xy


# --- 追加ここから ---
KYUSEI_CHOICES = [
    ("一白水星", "一白水星"),
    ("二黒土星", "二黒土星"),
    ("三碧木星", "三碧木星"),
    ("四緑木星", "四緑木星"),
    ("五黄土星", "五黄土星"),
    ("六白金星", "六白金星"),
    ("七赤金星", "七赤金星"),
    ("八白土星", "八白土星"),
    ("九紫火星", "九紫火星"),
]


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
    CATEGORY_CHOICES = [
        ("ご利益", "願望・テーマ別"),
        ("神格", "祭神の種類"),
        ("地域", "地域や役割"),
    ]

    name = models.CharField(max_length=50, unique=True)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, default="ご利益")

    def __str__(self) -> str:
        return f"{self.name} ({self.category})"

    class Meta:
        ordering = ["category", "name"]
        indexes = [models.Index(fields=["category", "name"])]


# ここでの Point は上のブロックで既に import/None 設定済み


class Shrine(models.Model):
    KIND_CHOICES = [("shrine", "神社"), ("temple", "寺院")]
    kind = models.CharField(max_length=10, choices=KIND_CHOICES, default="shrine", db_index=True)
    # 基本情報
    name_jp = models.CharField(max_length=100)
    name_romaji = models.CharField(max_length=100, blank=True, null=True)
    address = models.CharField(max_length=255)
    deities = models.ManyToManyField("Deity", related_name="shrines", blank=True)

    # 位置情報
    latitude = models.FloatField(
        null=True, blank=True, validators=[MinValueValidator(-90.0), MaxValueValidator(90.0)]
    )
    longitude = models.FloatField(
        null=True, blank=True, validators=[MinValueValidator(-180.0), MaxValueValidator(180.0)]
    )
    location = PointField(srid=4326, null=True, blank=True)

    # ご利益・祭神など
    goriyaku = models.TextField(help_text="ご利益（自由メモ）", blank=True, null=True, default="")
    sajin = models.TextField(help_text="祭神", blank=True, null=True, default="")
    description = models.TextField(blank=True, null=True)

    # 多対多
    goriyaku_tags = models.ManyToManyField("GoriyakuTag", related_name="shrines", blank=True)

    # 五行・属性
    element = models.CharField(
        max_length=10, blank=True, null=True, help_text="五行属性: 木火土金水"
    )

    # 九星（任意入力・タグ用途）
    kyusei = models.CharField(
        max_length=8,
        blank=True,
        null=True,
        choices=KYUSEI_CHOICES,
        help_text="九星（例: 九紫火星）",
    )

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
            models.Index(fields=["popular_score"], name="shrine_popular_idx"),
            models.Index(fields=["latitude"], name="idx_shrine_lat"),
            models.Index(fields=["longitude"], name="idx_shrine_lng"),
            models.Index(fields=["latitude", "longitude"], name="idx_shrine_lat_lng"),
            models.Index(fields=["kyusei"], name="idx_shrine_kyusei"),
            models.Index(fields=["kind"], name="idx_shrine_kind"),
        ]
        constraints = [
            CheckConstraint(
                condition=(
                    Q(latitude__isnull=True, longitude__isnull=True)
                    | Q(latitude__isnull=False, longitude__isnull=False)
                ),
                name="chk_lat_lng_both_or_none",
            ),
            # --- Partial unique (DB と宣言を一致) ---
            UniqueConstraint(
                fields=["name_jp", "address", "location"],
                condition=Q(location__isnull=False),
                name="uq_shrine_name_loc",
            ),
            UniqueConstraint(
                fields=["name_jp", "address"],
                condition=Q(location__isnull=True),
                name="uq_shrine_name_addr_when_loc_null",
            ),
            models.CheckConstraint(
                condition=Q(latitude__gte=-90.0) & Q(latitude__lte=90.0),
                name="chk_lat_range",
            ),
            models.CheckConstraint(
                condition=Q(longitude__gte=-180.0) & Q(longitude__lte=180.0),
                name="chk_lng_range",
            ),
        ]

    def save(self, *args, **kwargs):
        # NoGIS: Pointが来たら文字列に正規化（lon, lat）
        if (
            getattr(self, "location", None) is not None
            and "django.contrib.gis" not in settings.INSTALLED_APPS
        ):
            if Point is not None and isinstance(self.location, Point):
                # WKT風 or CSVいずれでもOK。下はWKT風で保存。
                self.location = f"POINT({self.location.x} {self.location.y})"

        # lat/lng → location 同期
        def _norm(v):
            return None if v in ("", None) else v

        lat = _norm(self.latitude)
        lng = _norm(self.longitude)

        new_location = None
        if lat is not None and lng is not None:
            if USE_REAL_GIS:
                new_location = Point(float(lng), float(lat), srid=4326)
            else:
                # 非GISは JSONField。GeoJSON 風に格納しておく（比較もしやすい）
                new_location = {
                    "type": "Point",
                    "coordinates": [float(lng), float(lat)],
                    "srid": 4326,
                }

        # 先頭で定義した型安全な _loc_changed() を使う
        if _loc_changed(self.location, new_location):
            self.location = new_location
            if "update_fields" in kwargs and kwargs["update_fields"] is not None:
                kwargs["update_fields"] = set(kwargs["update_fields"])
                kwargs["update_fields"].add("location")

        if "update_fields" in kwargs and kwargs["update_fields"] is not None:
            if "latitude" in kwargs["update_fields"]:
                self.latitude = lat
            if "longitude" in kwargs["update_fields"]:
                self.longitude = lng
            kwargs["update_fields"] = list(kwargs["update_fields"])
        else:
            self.latitude = lat
            self.longitude = lng

        return super().save(*args, **kwargs)


class Favorite(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="favorite_shrines"
    )
    shrine = models.ForeignKey(
        Shrine, on_delete=models.CASCADE, related_name="favorited_by", null=True, blank=True
    )
    place_id = models.CharField(max_length=128, null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        constraints = [
            CheckConstraint(
                name="favorite_exactly_one_target",
                condition=(
                    (Q(shrine__isnull=False) & Q(place_id__isnull=True))
                    | (Q(shrine__isnull=True) & Q(place_id__isnull=False))
                ),
            ),
            UniqueConstraint(
                fields=["user", "shrine"],
                name="uq_favorite_user_shrine",
                condition=Q(shrine__isnull=False),
            ),
            UniqueConstraint(
                fields=["user", "place_id"],
                name="uq_favorite_user_place",
                condition=Q(place_id__isnull=False),
            ),
        ]
        indexes = [
            models.Index(fields=["user", "created_at"], name="idx_fav_user_created"),
        ]


class Visit(models.Model):
    STATUS_CHOICES = [("added", "Added"), ("removed", "Removed")]
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="visits"
    )
    shrine = models.ForeignKey(Shrine, on_delete=models.CASCADE, related_name="visits")
    visited_at = models.DateTimeField(default=timezone.now)
    note = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="added")

    class Meta:
        ordering = ["-visited_at"]


class Goshuin(models.Model):
    shrine = models.ForeignKey(Shrine, on_delete=models.CASCADE, related_name="goshuins")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    title = models.CharField(max_length=100, blank=True)
    is_public = models.BooleanField(default=True)
    likes = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)


class GoshuinImage(models.Model):
    goshuin = models.ForeignKey(Goshuin, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to="goshuin/")
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]
        indexes = [models.Index(fields=["order"])]


class Like(models.Model):
    shrine = models.ForeignKey(Shrine, on_delete=models.CASCADE, related_name="likes")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["shrine", "user"], name="uq_like_shrine_user")
        ]


class RankingLog(models.Model):
    shrine = models.ForeignKey(Shrine, on_delete=models.CASCADE, related_name="ranking_logs")
    date = models.DateField(default=timezone.localdate)
    view_count = models.PositiveIntegerField(default=0)
    like_count = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["shrine", "date"], name="uq_rankinglog_shrine_date")
        ]


class ConciergeHistory(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="concierge_histories"
    )
    shrine = models.ForeignKey(
        Shrine,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="recommended_histories",
    )
    reason = models.TextField()
    tags = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at"]


class Deity(models.Model):
    name = models.CharField(max_length=64, unique=True)
    kana = models.CharField(max_length=128, blank=True, default="")
    aliases = models.CharField(
        max_length=256, blank=True, default=""
    )  # カンマ区切りでOK（後で正規化可）
    wiki_url = models.URLField(blank=True, default="")

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


# Shrine に ManyToMany を追加（既存 Shrine クラス内）
# deities = models.ManyToManyField("Deity", related_name="shrines", blank=True)
