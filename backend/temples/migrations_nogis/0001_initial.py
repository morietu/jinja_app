# backend/temples/migrations_nogis/0001_initial.py

from django.conf import settings
from django.contrib.postgres.indexes import GinIndex
from django.db import migrations, models

class Migration(migrations.Migration):
    initial = True
    dependencies = []

    operations = [
        # --- PlaceRef ---------------------------------------------------------
        migrations.CreateModel(
            name="PlaceRef",
            fields=[
                ("place_id", models.CharField(max_length=128, primary_key=True, serialize=False)),
                ("name", models.CharField(max_length=255, blank=True, default="")),
                ("address", models.CharField(max_length=255, blank=True, default="")),
                ("latitude", models.FloatField(null=True, blank=True)),
                ("longitude", models.FloatField(null=True, blank=True)),
                ("snapshot_json", models.JSONField(null=True, blank=True)),
                ("synced_at", models.DateTimeField(null=True, blank=True)),
            ],
            options={
                "db_table": "place_ref",
                "indexes": [
                    models.Index(fields=["name"], name="place_ref_name_idx"),
                    models.Index(fields=["synced_at"], name="place_ref_synced_idx"),
                    GinIndex(fields=["snapshot_json"], name="placeref_snapshot_gin"),
                ],
            },
        ),
        # --- Shrine -----------------------------------------------------------
        migrations.CreateModel(
            name="Shrine",
            fields=[
                ("id", models.BigAutoField(primary_key=True, serialize=False)),
                ("kind", models.CharField(max_length=10, default="shrine")),
                ("name_jp", models.CharField(max_length=255)),
                ("name_romaji", models.CharField(max_length=255, null=True, blank=True)),
                ("address", models.CharField(max_length=255, null=True, blank=True)),
                ("latitude", models.FloatField(null=True, blank=True)),
                ("longitude", models.FloatField(null=True, blank=True)),
                # NoGIS: 文字列（Pointは使わない）
                ("location", models.TextField(null=True, blank=True)),
                # JSON代替（既存互換のため空文字デフォルト）
                ("goriyaku", models.TextField(null=True, blank=True, default="")),
                ("sajin", models.TextField(null=True, blank=True, default="")),
                ("description", models.TextField(null=True, blank=True)),
                ("element", models.CharField(max_length=20, null=True, blank=True)),
                ("kyusei", models.CharField(max_length=20, null=True, blank=True)),
                ("views_30d", models.PositiveIntegerField(default=0)),
                ("favorites_30d", models.PositiveIntegerField(default=0)),
                ("popular_score", models.FloatField(default=0.0)),
                ("last_popular_calc_at", models.DateTimeField(null=True, blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("astro_elements", models.JSONField(default=list, blank=True)),
                (
                    "place_ref",
                    models.OneToOneField(
                        to="temples.placeref",
                        on_delete=models.SET_NULL,
                        null=True,
                        blank=True,
                        related_name="shrine",
                    ),
                ),
                (
                    "owner",
                    models.ForeignKey(
                        to=settings.AUTH_USER_MODEL,
                        null=True,
                        blank=True,
                        on_delete=models.SET_NULL,
                        related_name="owned_shrines",
                    ),
                ),
            ],
            options={
                "db_table": "temples_shrine",
                "indexes": [
                    models.Index(fields=["popular_score"], name="shrine_popular_idx"),
                    models.Index(fields=["name_jp"], name="idx_shrine_name_jp"),
                    models.Index(fields=["updated_at"], name="idx_shrine_updated_at"),
                    models.Index(fields=["latitude"], name="idx_shrine_lat"),
                    models.Index(fields=["longitude"], name="idx_shrine_lng"),
                    models.Index(fields=["latitude", "longitude"], name="idx_shrine_lat_lng"),
                    models.Index(fields=["kyusei"], name="idx_shrine_kyusei"),
                    models.Index(fields=["kind"], name="idx_shrine_kind"),
                ],
            },
        ),
        # --- GoriyakuTag ------------------------------------------------------
        migrations.CreateModel(
            name="GoriyakuTag",
            fields=[
                ("id", models.BigAutoField(primary_key=True, serialize=False)),
                ("name", models.CharField(max_length=64, unique=True)),
                ("category", models.CharField(max_length=32, null=True, blank=True)),
            ],
            options={"db_table": "temples_goriyakutag"},
        ),
        # --- Deity（kana あり｜重複定義なし） -----------------------------------
        migrations.CreateModel(
            name="Deity",
            fields=[
                ("id", models.BigAutoField(primary_key=True, serialize=False)),
                ("name", models.CharField(max_length=128, unique=True)),
                ("name_romaji", models.CharField(max_length=128, null=True, blank=True)),
                ("kana", models.CharField(max_length=128, null=True, blank=True)),
                ("aliases", models.TextField(null=True, blank=True)),
                ("wiki_url", models.URLField(null=True, blank=True)),
            ],
            options={"db_table": "temples_deity"},
        ),
        # --- Shrine ←→ Deity の M2M 中間テーブル（テーブル名固定） ---------------
        migrations.CreateModel(
            name="ShrineDeities",
            fields=[
                ("id", models.BigAutoField(primary_key=True, serialize=False)),
                ("shrine", models.ForeignKey(to="temples.shrine", on_delete=models.CASCADE)),
                ("deity", models.ForeignKey(to="temples.deity", on_delete=models.CASCADE)),
            ],
            options={
                "db_table": "temples_shrine_deities",
                "unique_together": {("shrine", "deity")},
            },
        ),
        # ManyToManyField 自体も Shrine に付与（prefetch用）
        migrations.AddField(
            model_name="shrine",
            name="deities",
            field=models.ManyToManyField(
                to="temples.deity",
                related_name="shrines",
                blank=True,
                through="temples.ShrineDeities",
            ),
        ),
        # --- Visit（ランキング/人気APIで使用） -----------------------------------
        migrations.CreateModel(
            name="Visit",
            fields=[
                ("id", models.BigAutoField(primary_key=True, serialize=False)),
                (
                    "user",
                    models.ForeignKey(
                        to=settings.AUTH_USER_MODEL,
                        on_delete=models.CASCADE,
                        related_name="visits",
                    ),
                ),
                ("shrine", models.ForeignKey(to="temples.shrine", on_delete=models.CASCADE)),
                ("visited_at", models.DateTimeField(auto_now_add=True)),
                ("note", models.TextField(null=True, blank=True)),
                ("status", models.CharField(max_length=16, default="added")),
            ],
            options={"db_table": "temples_visit"},
        ),
        migrations.AddIndex(
            model_name="visit",
            index=models.Index(fields=["visited_at"], name="visit_visited_idx"),
        ),
        migrations.AddIndex(
            model_name="visit",
            index=models.Index(fields=["shrine_id", "visited_at"], name="visit_shrine_visited_idx"),
        ),
        # --- Shrine.goriyaku_tags M2M -----------------------------------------
        migrations.AddField(
            model_name="shrine",
            name="goriyaku_tags",
            field=models.ManyToManyField(
                to="temples.goriyakutag",
                blank=True,
                related_name="shrines",
            ),
        ),
    ]
