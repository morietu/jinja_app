# -*- coding: utf-8 -*-
from __future__ import annotations

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.contrib.postgres.indexes import GinIndex
from django.db import models as dj_models
from django.db.models import CheckConstraint, Q, UniqueConstraint
from django.utils import timezone
from .models_places_seeds import PlacesSeed, PlacesSeedState  # noqa
from .models_concierge_analytics import ConciergeRecommendationLog
from .models_usage import FeatureUsage  # noqa
from .models_weekly_presentation import WeeklyPresentationSnapshot  # noqa
from temples.domain.evidence_provenance import EVIDENCE_MECHANISMS, EVIDENCE_PRODUCERS
from temples.domain.evidence_taxonomy import get_current_taxonomy_version
from temples.domain.goriyaku_taxonomy_v1 import (
    GORIYAKU_TAXONOMY_NAMESPACE,
    validate_goriyaku_v1_canonical_key,
)
from temples.domain.history_theme_taxonomy_v1 import (
    HISTORY_THEME_TAXONOMY_NAMESPACE,
    validate_history_theme_v1_canonical_key,
)

# GeoDjango switch
USE_REAL_GIS = bool(getattr(settings, "USE_GIS", False)) and not bool(
    getattr(settings, "DISABLE_GIS_FOR_TESTS", False)
)

if USE_REAL_GIS:
    from django.contrib.gis.db import models as models  # type: ignore
    from django.contrib.gis.geos import Point  # type: ignore
    from django.contrib.gis.db.models import PointField as PointFieldBase  # type: ignore
else:
    models = dj_models  # type: ignore
    Point = None

    class PointFieldBase(dj_models.JSONField):
        def __init__(self, *args, srid=None, geography=None, spatial_index=None, **kwargs):
            super().__init__(*args, **kwargs)


class CrawlTile(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        RUNNING = "running", "Running"
        DONE = "done", "Done"
        FAILED = "failed", "Failed"
        SKIPPED = "skipped", "Skipped"

    step_km = models.FloatField()

    min_lat = models.FloatField()
    min_lng = models.FloatField()
    max_lat = models.FloatField()
    max_lng = models.FloatField()

    center_lat = models.FloatField()
    center_lng = models.FloatField()

    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    tries = models.PositiveIntegerField(default=0)

    last_crawled_at = models.DateTimeField(null=True, blank=True)
    next_page_token = models.CharField(max_length=256, blank=True, default="")
    last_error = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["step_km", "min_lat", "min_lng", "max_lat", "max_lng"],
                name="uniq_crawltile_step_bbox",
            ),
        ]
        indexes = [
            models.Index(fields=["status", "last_crawled_at"]),
        ]

    def __str__(self) -> str:
        return f"tile({self.status}) step={self.step_km} bbox=({self.min_lat},{self.min_lng})-({self.max_lat},{self.max_lng})"


class ProductionDataBootstrapRun(models.Model):
    class Status(models.TextChoices):
        RUNNING = "running", "Running"
        SUCCESS = "success", "Success"
        FAILED = "failed", "Failed"

    step = models.CharField(max_length=100)
    version = models.CharField(max_length=100)
    command = models.CharField(max_length=100)
    args = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.RUNNING)
    attempts = models.PositiveIntegerField(default=0)
    last_error = models.TextField(blank=True, default="")
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["step", "version"],
                name="uniq_production_bootstrap_step_version",
            ),
        ]
        indexes = [
            models.Index(fields=["status", "updated_at"], name="idx_bootstrap_status_updated"),
            models.Index(fields=["step", "version"], name="idx_bootstrap_step_version"),
        ]

    def __str__(self) -> str:
        return f"{self.step}@{self.version} ({self.status})"



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


class PlaceRef(dj_models.Model):
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


class Shrine(dj_models.Model):
    KIND_CHOICES = [("shrine", "神社"), ("temple", "寺院")]
    kind = models.CharField(max_length=10, choices=KIND_CHOICES, default="shrine", db_index=True)
    # 基本情報
    name_jp = models.CharField(max_length=100)
    name_romaji = models.CharField(max_length=100, blank=True, null=True)
    address = models.CharField(max_length=255, blank=True, default="")


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

    # 歴史・文脈タグ（推薦理由の説明補助）
    history_theme = models.CharField(
        max_length=32,
        blank=True,
        default="",
        help_text="神社の歴史文脈タグ: 再出発 / 静寂 / 復興 / 勝負 / 縁 / 学び / 守り",
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
    astro_elements = models.JSONField(default=list, blank=True, help_text="西洋占星術エレメント: ['火','土','風','水']")
    visit_style_tags = models.JSONField(default=list, blank=True, help_text="参拝スタイルタグ: ['quiet','nature','classic'] など")

    place_ref = models.OneToOneField(
        "PlaceRef",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="shrine",
    )

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="owned_shrines",
    )

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
            models.Index(fields=["history_theme"], name="idx_shrine_history_theme"),
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
                condition=Q(location__isnull=False) & Q(place_ref__isnull=True),
                name="uq_shrine_name_loc",
            ),
            UniqueConstraint(
                fields=["name_jp", "address"],
                condition=Q(location__isnull=True) & Q(place_ref__isnull=True),
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


def _validate_not_blank(value: str) -> None:
    """空白のみの文字列を禁止する（docs/knowledge/shrine-knowledge-contract.md準拠）。"""
    if not (value or "").strip():
        raise ValidationError("空白のみの値は許可されません。", code="blank_not_allowed")


# docs/knowledge/shrine-knowledge-contract.md「Source契約」の verification_status / confidence 共通enum。
KNOWLEDGE_VERIFICATION_STATUS_CHOICES = [
    ("draft", "draft"),
    ("unverified", "unverified"),
    ("source_confirmed", "source_confirmed"),
    ("reviewed", "reviewed"),
    ("disputed", "disputed"),
    ("outdated", "outdated"),
    ("rejected", "rejected"),
]

# Fact表示可能とみなすverification_status（Evidence Gate要件の実装はPR2で行うため、
# 本PRではAPI返却フィルタとしてのみ利用する）。
KNOWLEDGE_FACT_READY_VERIFICATION_STATUSES = ("source_confirmed", "reviewed")

KNOWLEDGE_CONFIDENCE_CHOICES = [
    ("low", "low"),
    ("medium", "medium"),
    ("high", "high"),
]


def _validate_verified_at_consistency(verification_status: str, verified_at) -> None:
    """source_confirmed / reviewed は確認日時を伴う（docs/knowledge/shrine-knowledge-contract.md準拠）。"""
    if verification_status in KNOWLEDGE_FACT_READY_VERIFICATION_STATUSES and verified_at is None:
        raise ValidationError(
            {
                "verified_at": (
                    f"verification_status='{verification_status}' の場合、"
                    "verified_at の設定が必要です。"
                )
            }
        )


class ShrineKnowledgeSource(models.Model):
    """神社Knowledge（ShrineDeity / ShrineHistory）の出典。docs/knowledge/shrine-knowledge-contract.md「Source契約」の実装。"""

    SOURCE_TYPE_CHOICES = [
        ("shrine_official", "shrine_official"),
        ("government", "government"),
        ("cultural_property", "cultural_property"),
        ("academic", "academic"),
        ("museum_or_archive", "museum_or_archive"),
        ("local_history", "local_history"),
        ("tourism_official", "tourism_official"),
        ("secondary_editorial", "secondary_editorial"),
        ("user_observation", "user_observation"),
        ("internal_research", "internal_research"),
        # AI GeneratedはSourceとして扱わない（shrine-knowledge-contract.md「AI Generated Draft」分類を参照）。
    ]

    source_type = models.CharField(max_length=32, choices=SOURCE_TYPE_CHOICES)
    title = models.CharField(max_length=255, validators=[_validate_not_blank])
    publisher = models.CharField(max_length=255, blank=True, default="")
    url = models.URLField(blank=True, default="")
    bibliography = models.TextField(blank=True, default="")
    accessed_at = models.DateField(null=True, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    verification_status = models.CharField(
        max_length=32,
        choices=KNOWLEDGE_VERIFICATION_STATUS_CHOICES,
        default="draft",
    )
    confidence = models.CharField(
        max_length=8, choices=KNOWLEDGE_CONFIDENCE_CHOICES, blank=True, default=""
    )
    language = models.CharField(max_length=16, blank=True, default="")
    note = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.get_source_type_display()}: {self.title}"

    def clean(self) -> None:
        super().clean()
        _validate_verified_at_consistency(self.verification_status, self.verified_at)


class ShrineDeity(models.Model):
    """神社の祭神Knowledge。docs/knowledge/shrine-knowledge-contract.md「deity契約」の実装。"""

    ROLE_CHOICES = [
        ("primary", "primary"),
        ("enshrined", "enshrined"),
        ("secondary", "secondary"),
        ("unknown", "unknown"),
    ]

    shrine = models.ForeignKey(Shrine, on_delete=models.CASCADE, related_name="deities")
    display_name = models.CharField(max_length=255, validators=[_validate_not_blank])
    canonical_name = models.CharField(max_length=255, blank=True, default="")
    role = models.CharField(max_length=16, choices=ROLE_CHOICES, default="unknown")
    sort_order = models.IntegerField(default=0, validators=[MinValueValidator(0)])
    sources = models.ManyToManyField(ShrineKnowledgeSource, related_name="deities", blank=True)
    verification_status = models.CharField(
        max_length=32,
        choices=KNOWLEDGE_VERIFICATION_STATUS_CHOICES,
        default="draft",
    )
    confidence = models.CharField(
        max_length=8, choices=KNOWLEDGE_CONFIDENCE_CHOICES, blank=True, default=""
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    note = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "id"]
        indexes = [
            models.Index(fields=["shrine", "sort_order"], name="idx_shrine_deity_sort"),
        ]

    def __str__(self) -> str:
        return f"{self.shrine_id}:{self.display_name}"

    def clean(self) -> None:
        super().clean()
        _validate_verified_at_consistency(self.verification_status, self.verified_at)


class ShrineHistory(models.Model):
    """神社の由緒・歴史Knowledge。docs/knowledge/shrine-knowledge-contract.md「shrine_history契約」の実装。"""

    HISTORY_TYPE_CHOICES = [
        ("official_origin", "official_origin"),
        ("founding", "founding"),
        ("historical_event", "historical_event"),
        ("tradition", "tradition"),
        ("regional_context", "regional_context"),
        ("editorial_summary", "editorial_summary"),
    ]

    shrine = models.ForeignKey(Shrine, on_delete=models.CASCADE, related_name="histories")
    history_type = models.CharField(max_length=32, choices=HISTORY_TYPE_CHOICES)
    title = models.CharField(max_length=255, validators=[_validate_not_blank])
    content = models.TextField(validators=[_validate_not_blank])
    period_text = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="推定年代等、幅を持つ期間表現（例: 8世紀頃）。確定日はevent_dateを使う。",
    )
    event_date = models.DateField(null=True, blank=True, help_text="確定している場合のみ設定する。")
    sort_order = models.IntegerField(default=0, validators=[MinValueValidator(0)])
    sources = models.ManyToManyField(ShrineKnowledgeSource, related_name="histories", blank=True)
    verification_status = models.CharField(
        max_length=32,
        choices=KNOWLEDGE_VERIFICATION_STATUS_CHOICES,
        default="draft",
    )
    confidence = models.CharField(
        max_length=8, choices=KNOWLEDGE_CONFIDENCE_CHOICES, blank=True, default=""
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    note = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "id"]
        verbose_name_plural = "Shrine histories"
        indexes = [
            models.Index(fields=["shrine", "sort_order"], name="idx_shrine_history_sort"),
        ]

    def __str__(self) -> str:
        return f"{self.shrine_id}:{self.title}"

    def clean(self) -> None:
        super().clean()
        _validate_verified_at_consistency(self.verification_status, self.verified_at)


class HistoryThemeAssignment(models.Model):
    """Evidence Foundation PR-F2: history_theme semantic assignmentの
    qualification path。docs/knowledge/evidence-foundation-shared-contract.md
    「HistoryThemeAssignment」節を参照。

    既存`Shrine.history_theme`（compatibility / 現行read path）とは独立
    しており、どちらもこのモデルによって自動的に書き換えられることはない。
    このモデル単体はまだQualified Evidenceではない（Source Evidence link
    はPR-F4）。
    """

    class Lifecycle(models.TextChoices):
        ACTIVE = "ACTIVE", "ACTIVE"
        SUPERSEDED = "SUPERSEDED", "SUPERSEDED"

    shrine = models.ForeignKey(
        Shrine, on_delete=models.CASCADE, related_name="history_theme_assignments"
    )
    canonical_key = models.CharField(
        max_length=64,
        help_text="Evidence Foundation canonical semantic key（例: history_theme:restart）。"
        "Shrine.history_themeの日本語表示値とは別の、機械識別子。",
    )
    taxonomy_version = models.CharField(
        max_length=8,
        help_text="canonical_keyがどのhistory_theme taxonomy versionで解釈されるか"
        "（Mother Ship FINAL contract: 文字列表現、例 \"v1\"）。",
    )
    lifecycle = models.CharField(
        max_length=16,
        choices=Lifecycle.choices,
    )
    producer = models.CharField(
        max_length=32,
        choices=[(value, value) for value in EVIDENCE_PRODUCERS],
        help_text="PR-F1 evidence_provenance.EVIDENCE_PRODUCERSをそのまま再利用。",
    )
    mechanism = models.CharField(
        max_length=32,
        choices=[(value, value) for value in EVIDENCE_MECHANISMS],
        help_text="PR-F1 evidence_provenance.EVIDENCE_MECHANISMSをそのまま再利用。",
    )
    assigned_at = models.DateTimeField(
        help_text="provenanceに基づく、実際にsemantic assignmentが行われた時刻。"
        "created_at（DB行の作成時刻）とは責務が異なり、呼び出し側が明示的に指定する。",
    )
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["shrine_id", "-created_at"]
        constraints = [
            UniqueConstraint(
                fields=["shrine"],
                condition=Q(lifecycle="ACTIVE"),
                name="uniq_history_theme_assignment_active_per_shrine",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.shrine_id}:{self.canonical_key}:{self.lifecycle}"

    def clean(self) -> None:
        super().clean()

        key_validation = validate_history_theme_v1_canonical_key(self.canonical_key)
        if not key_validation.valid:
            raise ValidationError(
                {
                    "canonical_key": (
                        f"canonical_keyが無効です（reason={key_validation.reason}）: "
                        f"{self.canonical_key!r}"
                    )
                }
            )

        current_version = get_current_taxonomy_version(HISTORY_THEME_TAXONOMY_NAMESPACE).version
        if self.taxonomy_version != current_version:
            raise ValidationError(
                {
                    "taxonomy_version": (
                        f"taxonomy_version={self.taxonomy_version!r}は現行version"
                        f"（{current_version!r}）と一致しません。"
                    )
                }
            )


class ShrineGoriyakuAssignment(models.Model):
    """Evidence Foundation PR-F3: goriyaku semantic assignmentの
    qualification path。docs/knowledge/evidence-foundation-shared-contract.md
    「ShrineGoriyakuAssignment」節を参照。

    既存`Shrine.goriyaku_tags`（M2M、Recommendation Signal / compatibility
    layer）とは完全に独立しており、どちらもこのモデルによって自動的に
    書き換えられることはない。このモデル単体はまだQualified Evidenceでは
    ない（Source Evidence linkはPR-F4）。

    重要（G1 DATA_REVIEW）: 承認済みcanonical key registry
    （`temples.domain.goriyaku_taxonomy_v1.GORIYAKU_V1_CANONICAL_KEYS`）は
    18件でactivated済みである。PR-F3時点の「意図的に空 / いかなる
    canonical_keyも受理しない」はpoint-in-time recordであり、現行の
    CURRENT FACTではない。承認済み18件以外のcanonical keyは引き続き
    fail-closedでrejectされる。

    NOTE: `canonical_key`のhelp_textはPR-F3時点の文面のままである。
    help_textの変更はschema migrationを発生させるため、migration 0件を
    要件とするG1では変更していない（文言更新は後続のmigration可能なPRで
    行う）。
    """

    class Lifecycle(models.TextChoices):
        ACTIVE = "ACTIVE", "ACTIVE"
        REVOKED = "REVOKED", "REVOKED"

    shrine = models.ForeignKey(
        Shrine, on_delete=models.CASCADE, related_name="goriyaku_assignments"
    )
    canonical_key = models.CharField(
        max_length=64,
        help_text="Evidence Foundation canonical semantic key（例: goriyaku:<stable_key>）。"
        "既存GoriyakuTag.nameとは別の、機械識別子。PR-F3時点では承認済みkeyが"
        "存在しないため、いかなる値も現時点ではvalidationを通過しない。",
    )
    taxonomy_version = models.CharField(
        max_length=8,
        help_text="canonical_keyがどのgoriyaku taxonomy versionで解釈されるか"
        "（Mother Ship FINAL contract: 文字列表現、例 \"v1\"）。",
    )
    lifecycle = models.CharField(
        max_length=16,
        choices=Lifecycle.choices,
    )
    producer = models.CharField(
        max_length=32,
        choices=[(value, value) for value in EVIDENCE_PRODUCERS],
        help_text="PR-F1 evidence_provenance.EVIDENCE_PRODUCERSをそのまま再利用。",
    )
    mechanism = models.CharField(
        max_length=32,
        choices=[(value, value) for value in EVIDENCE_MECHANISMS],
        help_text="PR-F1 evidence_provenance.EVIDENCE_MECHANISMSをそのまま再利用。",
    )
    assigned_at = models.DateTimeField(
        help_text="provenanceに基づく、実際にsemantic assignmentが行われた時刻。"
        "created_at（DB行の作成時刻）とは責務が異なり、呼び出し側が明示的に指定する。",
    )
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["shrine_id", "canonical_key", "-created_at"]
        constraints = [
            UniqueConstraint(
                fields=["shrine", "canonical_key", "taxonomy_version"],
                condition=Q(lifecycle="ACTIVE"),
                name="uniq_goriyaku_assignment_active_per_shrine_tag_version",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.shrine_id}:{self.canonical_key}:{self.lifecycle}"

    def clean(self) -> None:
        super().clean()

        key_validation = validate_goriyaku_v1_canonical_key(self.canonical_key)
        if not key_validation.valid:
            raise ValidationError(
                {
                    "canonical_key": (
                        f"canonical_keyが無効です（reason={key_validation.reason}）: "
                        f"{self.canonical_key!r}"
                    )
                }
            )

        current_version = get_current_taxonomy_version(GORIYAKU_TAXONOMY_NAMESPACE).version
        if self.taxonomy_version != current_version:
            raise ValidationError(
                {
                    "taxonomy_version": (
                        f"taxonomy_version={self.taxonomy_version!r}は現行version"
                        f"（{current_version!r}）と一致しません。"
                    )
                }
            )


class EvidenceLink(models.Model):
    """Semantic AssignmentとStored Factの根拠edgeを永続化するF4 foundation。"""

    history_theme_assignment = models.ForeignKey(
        HistoryThemeAssignment,
        on_delete=models.CASCADE,
        related_name="evidence_links",
        null=True,
        blank=True,
    )
    goriyaku_assignment = models.ForeignKey(
        ShrineGoriyakuAssignment,
        on_delete=models.CASCADE,
        related_name="evidence_links",
        null=True,
        blank=True,
    )
    shrine_history = models.ForeignKey(
        ShrineHistory,
        on_delete=models.PROTECT,
        related_name="evidence_links",
        null=True,
        blank=True,
    )
    shrine_deity = models.ForeignKey(
        ShrineDeity,
        on_delete=models.PROTECT,
        related_name="evidence_links",
        null=True,
        blank=True,
    )
    rationale = models.TextField()
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["id"]
        constraints = [
            CheckConstraint(
                condition=(
                    Q(history_theme_assignment__isnull=False, goriyaku_assignment__isnull=True)
                    | Q(history_theme_assignment__isnull=True, goriyaku_assignment__isnull=False)
                ),
                name="chk_evlink_one_assignment",
            ),
            CheckConstraint(
                condition=(
                    Q(shrine_history__isnull=False, shrine_deity__isnull=True)
                    | Q(shrine_history__isnull=True, shrine_deity__isnull=False)
                ),
                name="chk_evlink_one_fact",
            ),
            CheckConstraint(condition=~Q(rationale=""), name="chk_evlink_rationale_nonempty"),
            UniqueConstraint(
                fields=["history_theme_assignment", "shrine_history"],
                condition=Q(
                    history_theme_assignment__isnull=False,
                    shrine_history__isnull=False,
                ),
                name="uniq_evlink_ht_history",
            ),
            UniqueConstraint(
                fields=["history_theme_assignment", "shrine_deity"],
                condition=Q(
                    history_theme_assignment__isnull=False,
                    shrine_deity__isnull=False,
                ),
                name="uniq_evlink_ht_deity",
            ),
            UniqueConstraint(
                fields=["goriyaku_assignment", "shrine_history"],
                condition=Q(
                    goriyaku_assignment__isnull=False,
                    shrine_history__isnull=False,
                ),
                name="uniq_evlink_gori_history",
            ),
            UniqueConstraint(
                fields=["goriyaku_assignment", "shrine_deity"],
                condition=Q(
                    goriyaku_assignment__isnull=False,
                    shrine_deity__isnull=False,
                ),
                name="uniq_evlink_gori_deity",
            ),
        ]

    def clean(self) -> None:
        super().clean()
        errors = {}

        assignment_fields = (
            "history_theme_assignment",
            "goriyaku_assignment",
        )
        fact_fields = ("shrine_history", "shrine_deity")
        selected_assignment_fields = [
            field for field in assignment_fields if getattr(self, f"{field}_id") is not None
        ]
        selected_fact_fields = [
            field for field in fact_fields if getattr(self, f"{field}_id") is not None
        ]

        if len(selected_assignment_fields) != 1:
            errors["history_theme_assignment"] = (
                "history_theme_assignment / goriyaku_assignmentのどちらか一方だけが必要です。"
            )
        if len(selected_fact_fields) != 1:
            errors["shrine_history"] = (
                "shrine_history / shrine_deityのどちらか一方だけが必要です。"
            )
        if not isinstance(self.rationale, str) or not self.rationale.strip():
            errors["rationale"] = "rationaleは空白以外の文字を1文字以上必要とします。"

        if len(selected_assignment_fields) == 1 and len(selected_fact_fields) == 1:
            assignment_field = selected_assignment_fields[0]
            fact_field = selected_fact_fields[0]
            try:
                assignment = getattr(self, assignment_field)
            except HistoryThemeAssignment.DoesNotExist:
                assignment = None
            except ShrineGoriyakuAssignment.DoesNotExist:
                assignment = None
            try:
                fact = getattr(self, fact_field)
            except ShrineHistory.DoesNotExist:
                fact = None
            except ShrineDeity.DoesNotExist:
                fact = None

            if assignment is None:
                errors[assignment_field] = "参照するAssignmentを解決できません。"
            if fact is None:
                errors[fact_field] = "参照するStored Factを解決できません。"
            if assignment is not None and fact is not None:
                if assignment.shrine_id != fact.shrine_id:
                    errors[fact_field] = "AssignmentとStored Factは同じShrineに属する必要があります。"

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
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
            models.UniqueConstraint(
                fields=["user", "shrine"],
                condition=Q(shrine__isnull=False),
                name="uniq_favorite_user_shrine",
            ),
            models.UniqueConstraint(
                fields=["user", "place_id"],
                condition=Q(place_id__isnull=False),
                name="uniq_favorite_user_place",
            ),
            models.CheckConstraint(
                check=(
                    (Q(shrine__isnull=False) & Q(place_id__isnull=True))
                    | (Q(shrine__isnull=True) & Q(place_id__isnull=False))
                ),
                name="chk_favorite_exactly_one_target",
            ),
        ]
        indexes = [
            models.Index(fields=["user", "created_at"], name="idx_fav_user_created"),
        ]

class ConciergeThread(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="concierge_threads",
        null=True,
        blank=True,
    )
    anonymous_id = models.CharField(max_length=64, null=True, blank=True, db_index=True)

    title = models.CharField(max_length=255, blank=True, default="")
    main_shrine = models.ForeignKey(
        "Shrine",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="concierge_threads",
    )
    tags = models.JSONField(default=list, blank=True)

    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    last_message_at = models.DateTimeField(null=True, blank=True)

    recommendations = models.JSONField(null=True, blank=True)
    recommendations_v2 = models.JSONField(null=True, blank=True)

    class Meta:
        ordering = ["-last_message_at", "-id"]
        indexes = [
            models.Index(fields=["user", "last_message_at"]),
            models.Index(fields=["anonymous_id", "last_message_at"]),
        ]
        constraints = [
            models.CheckConstraint(
                check=Q(user__isnull=False) | Q(anonymous_id__isnull=False),
                name="concierge_thread_user_or_anonymous_required",
            ),
        ]

    def __str__(self) -> str:
        return self.title or f"Thread #{self.pk}"


class ConciergeMessage(models.Model):
    ROLE_USER = "user"
    ROLE_ASSISTANT = "assistant"
    ROLE_SYSTEM = "system"
    ROLE_CHOICES = [
        (ROLE_USER, "User"),
        (ROLE_ASSISTANT, "Assistant"),
        (ROLE_SYSTEM, "System"),
    ]

    thread = models.ForeignKey(
        ConciergeThread,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    content = models.TextField()
    created_at = models.DateTimeField(default=timezone.now)
    # 必要ならメタ情報
    meta = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["thread", "created_at"]),
        ]

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new:
            # Thread 側の last_message_at を更新
            ConciergeThread.objects.filter(pk=self.thread_id).update(
                last_message_at=self.created_at
            )

class Visit(models.Model):
    STATUS_CHOICES = [("added", "Added"), ("removed", "Removed")]
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="visits"
    )
    shrine = models.ForeignKey(Shrine, on_delete=models.CASCADE, related_name="visits")
    thread = models.ForeignKey(
        ConciergeThread,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="visits",
        help_text="参拝のきっかけとなった相談スレッド（Recommendation Snapshotへの接続キー）",
    )
    visited_at = models.DateTimeField(default=timezone.now)
    note = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="added")


    class Meta:
        ordering = ["-visited_at"]


# --- ShrineReflection model ---

class ShrineReflection(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="shrine_reflections",
    )
    shrine = models.ForeignKey(
        Shrine,
        on_delete=models.CASCADE,
        related_name="reflections",
    )
    thread = models.ForeignKey(
        ConciergeThread,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reflections",
        help_text="振り返り対象の参拝のきっかけとなった相談スレッド（Recommendation Snapshotへの接続キー）",
    )
    history_theme = models.CharField(
        max_length=32,
        blank=True,
        default="",
        help_text="保存時点の history_theme スナップショット",
    )
    prompt = models.TextField(blank=True, default="")
    answer = models.TextField()
    mood_before = models.CharField(max_length=50, blank=True, default="")
    mood_after = models.CharField(max_length=50, blank=True, default="")
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "-created_at"], name="idx_reflection_user_created"),
            models.Index(fields=["shrine", "-created_at"], name="idx_reflection_shrine_created"),
            models.Index(fields=["history_theme"], name="idx_reflection_history_theme"),
        ]

    def __str__(self) -> str:
        return f"Reflection #{self.pk} shrine={self.shrine_id} user={self.user_id}"



class ShrineInteractionLog(models.Model):
    class ActionType(models.TextChoices):
        DETAIL_VIEW = "detail_view", "Detail view"
        ROUTE_OPEN = "route_open", "Route open"
        SHRINE_CARD_CLICK = "shrine_card_click", "Shrine card click"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="shrine_interaction_logs",
    )
    shrine = models.ForeignKey(
        Shrine,
        on_delete=models.CASCADE,
        related_name="interaction_logs",
    )
    action_type = models.CharField(
        max_length=32,
        choices=ActionType.choices,
        db_index=True,
    )
    source = models.CharField(max_length=64, blank=True, default="", db_index=True)
    thread = models.ForeignKey(
        ConciergeThread,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="shrine_interaction_logs",
    )
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "shrine", "action_type"], name="idx_interact_user_shrine_act"),
            models.Index(fields=["user", "-created_at"], name="idx_interaction_user_created"),
            models.Index(fields=["shrine", "-created_at"], name="idx_interaction_shrine_created"),
        ]

    def __str__(self) -> str:
        return f"Interaction #{self.pk} shrine={self.shrine_id} user={self.user_id} action={self.action_type}"


class ActionEvent(models.Model):
    """Track user actions for action suggestions.

    ShrineInteractionLog tracks behavior toward a shrine, such as detail_view and route_open.
    ActionEvent tracks behavior toward an action suggestion, such as action_started and action_completed.
    Keeping them separate prevents shrine behavior metrics and action recommendation metrics from mixing.
    """

    class ActionType(models.TextChoices):
        ACTION_STARTED = "action_started", "Action started"
        ACTION_COMPLETED = "action_completed", "Action completed"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="action_events",
    )
    shrine = models.ForeignKey(
        Shrine,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="action_events",
    )
    thread = models.ForeignKey(
        ConciergeThread,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="action_events",
    )
    action_type = models.CharField(
        max_length=32,
        choices=ActionType.choices,
        db_index=True,
    )
    action_suggestion_id = models.CharField(max_length=128, db_index=True)
    history_theme = models.CharField(max_length=32, blank=True, default="", db_index=True)
    action_category = models.CharField(max_length=32, blank=True, default="", db_index=True)
    source = models.CharField(max_length=64, blank=True, default="", db_index=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "action_type"], name="idx_action_user_type"),
            models.Index(fields=["user", "-created_at"], name="idx_action_user_created"),
            models.Index(fields=["history_theme", "action_type"], name="idx_action_theme_type"),
            models.Index(fields=["action_suggestion_id", "action_type"], name="idx_action_suggestion_type"),
        ]

    def __str__(self) -> str:
        return f"ActionEvent #{self.pk} user={self.user_id} action={self.action_type} suggestion={self.action_suggestion_id}"


class Goshuin(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="goshuin",
    )
    shrine = models.ForeignKey(
        Shrine, on_delete=models.CASCADE, related_name="goshuins", null=False
    )

    title = models.CharField(max_length=100, blank=True)

    is_public = models.BooleanField(default=False, db_index=True)


    likes = models.PositiveIntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    # image = models.ImageField(upload_to="goshuin/")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    

    class Meta:
        ordering = ["-created_at"]


class GoshuinImage(models.Model):
    goshuin = models.ForeignKey(Goshuin, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to="goshuin/")
    order = models.PositiveIntegerField(default=0)

    size_bytes = models.BigIntegerField(default=0)

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
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="concierge_histories"
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

class ConciergeUsage(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="concierge_usages",
    )
    date = models.DateField(db_index=True)
    count = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ("user", "date")
        verbose_name = "コンシェルジュ利用状況"
        verbose_name_plural = "コンシェルジュ利用状況"

    def __str__(self) -> str:
        return f"{self.user} @ {self.date}: {self.count}"


class ShrineSubmission(dj_models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="shrine_submissions",
    )

    name = models.CharField(max_length=255)
    address = models.CharField(max_length=512)

    lat = models.FloatField(
        null=True,
        blank=True,
        validators=[MinValueValidator(-90.0), MaxValueValidator(90.0)],
    )
    lng = models.FloatField(
        null=True,
        blank=True,
        validators=[MinValueValidator(-180.0), MaxValueValidator(180.0)],
    )

    goriyaku_tags = models.JSONField(default=list, blank=True)
    note = models.TextField(blank=True, default="")

    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )

    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reviewed_shrine_submissions",
    )
    review_comment = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "created_at"], name="idx_submission_status_created"),
            models.Index(fields=["user", "created_at"], name="idx_submission_user_created"),
        ]
        constraints = [
            CheckConstraint(
                condition=(
                    Q(lat__isnull=True, lng__isnull=True)
                    | Q(lat__isnull=False, lng__isnull=False)
                ),
                name="chk_submission_lat_lng_both_or_none",
            ),
        ]

    def __str__(self) -> str:
        return f"[{self.status}] {self.name}"

class ShrineCandidate(dj_models.Model):
    class Status(models.TextChoices):
        AUTO = "auto", "Auto"
        APPROVED = "approved", "Approved"
        IMPORTED = "imported", "Imported"
        REJECTED = "rejected", "Rejected"

    class Source(models.TextChoices):
        RESOLVE = "resolve", "Resolve"
        MANUAL = "manual", "Manual"
        PLACES_FIND = "places_find", "PlacesFind"
        STUB = "stub", "Stub (legacy)"

    place_id = models.CharField(max_length=255, null=True, blank=True, db_index=True)

    name_jp = models.CharField(max_length=255)
    address = models.CharField(max_length=512, blank=True, default="")
    lat = models.FloatField(null=True, blank=True)
    lng = models.FloatField(null=True, blank=True)

    goriyaku = models.CharField(max_length=255, blank=True, default="")

    source = models.CharField(
        max_length=64,
        choices=Source.choices,
        default=Source.MANUAL,
        db_index=True,
    )
    raw = models.JSONField(default=dict, blank=True)

    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.AUTO,
        db_index=True,
    )

    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    synced_at = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=["status", "created_at"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["place_id", "status"],
                name="uniq_candidate_place_id",
                condition=Q(place_id__isnull=False),
            )
        ]
    def __str__(self) -> str:
        return f"[{self.status}] {self.name_jp}"


class PlaceCache(models.Model):
    place_id = models.CharField(max_length=255, unique=True)

    name = models.CharField(max_length=255, blank=True, default="")
    address = models.CharField(max_length=255, blank=True, default="")

    lat = models.FloatField(null=True, blank=True)
    lng = models.FloatField(null=True, blank=True)

    rating = models.FloatField(null=True, blank=True)
    user_ratings_total = models.IntegerField(null=True, blank=True)

    types = models.JSONField(default=list, blank=True)
    raw = models.JSONField(default=dict, blank=True)

    fetched_at = models.DateTimeField(auto_now=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "place_cache"
        indexes = [
            models.Index(fields=["fetched_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.place_id})"
