from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ("temples", "0002_goshuin_shrine"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ConciergeThread",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("title", models.CharField(blank=True, default="", max_length=255)),
                ("tags", models.JSONField(blank=True, default=list)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("last_message_at", models.DateTimeField(blank=True, null=True)),
                ("recommendations", models.JSONField(blank=True, null=True)),
                ("recommendations_v2", models.JSONField(blank=True, null=True)),
                (
                    "main_shrine",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="concierge_threads",
                        to="temples.shrine",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="concierge_threads",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-last_message_at", "-id"],
            },
        ),
        migrations.AddIndex(
            model_name="conciergethread",
            index=models.Index(
                fields=["user", "last_message_at"],
                name="temples_con_user_id_c38936_idx",
            ),
        ),
        migrations.CreateModel(
            name="ConciergeMessage",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "role",
                    models.CharField(
                        choices=[
                            ("user", "User"),
                            ("assistant", "Assistant"),
                            ("system", "System"),
                        ],
                        max_length=20,
                    ),
                ),
                ("content", models.TextField()),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("meta", models.JSONField(blank=True, default=dict)),
                (
                    "thread",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="messages",
                        to="temples.conciergethread",
                    ),
                ),
            ],
            options={
                "ordering": ["created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="conciergemessage",
            index=models.Index(
                fields=["thread", "created_at"],
                name="temples_con_thread__0068fd_idx",
            ),
        ),
        migrations.CreateModel(
            name="ConciergeUsage",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("date", models.DateField(db_index=True)),
                ("count", models.PositiveIntegerField(default=0)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="concierge_usages",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "コンシェルジュ利用状況",
                "verbose_name_plural": "コンシェルジュ利用状況",
                "unique_together": {("user", "date")},
            },
        ),
        migrations.CreateModel(
            name="ConciergeRecommendationLog",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("query", models.TextField(blank=True, default="")),
                ("need_tags", models.JSONField(blank=True, default=list)),
                ("flow", models.CharField(blank=True, default="", max_length=8)),
                ("llm_enabled", models.BooleanField(default=False)),
                ("llm_used", models.BooleanField(default=False)),
                ("recommendations", models.JSONField(blank=True, default=list)),
                ("result_state", models.JSONField(blank=True, default=dict)),
                ("lat", models.FloatField(blank=True, null=True)),
                ("lng", models.FloatField(blank=True, null=True)),
                ("radius_m", models.IntegerField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "thread",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="recommendation_logs",
                        to="temples.conciergethread",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="concierge_recommendation_logs",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "db_table": "temples_concierge_recommendation_log",
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="ShrineCandidate",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "place_id",
                    models.CharField(
                        blank=True,
                        null=True,
                        max_length=255,
                        db_index=True,
                    ),
                ),
                ("name_jp", models.CharField(max_length=255)),
                ("address", models.CharField(blank=True, default="", max_length=512)),
                ("lat", models.FloatField(blank=True, null=True)),
                ("lng", models.FloatField(blank=True, null=True)),
                ("goriyaku", models.CharField(blank=True, default="", max_length=255)),
                (
                    "source",
                    models.CharField(
                        choices=[
                            ("resolve", "Resolve"),
                            ("manual", "Manual"),
                            ("places_find", "PlacesFind"),
                            ("stub", "Stub (legacy)"),
                        ],
                        db_index=True,
                        default="manual",
                        max_length=64,
                    ),
                ),
                ("raw", models.JSONField(blank=True, default=dict)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("auto", "Auto"),
                            ("approved", "Approved"),
                            ("imported", "Imported"),
                            ("rejected", "Rejected"),
                        ],
                        db_index=True,
                        default="auto",
                        max_length=16,
                    ),
                ),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("synced_at", models.DateTimeField(blank=True, null=True, db_index=True)),
            ],
        ),
        migrations.AddIndex(
            model_name="shrinecandidate",
            index=models.Index(
                fields=["status", "created_at"],
                name="temples_shr_status_9a0be4_idx",
            ),
        ),
        migrations.AddConstraint(
            model_name="shrinecandidate",
            constraint=models.UniqueConstraint(
                fields=("place_id", "status"),
                condition=models.Q(("place_id__isnull", False)),
                name="uniq_candidate_place_id",
            ),
        ),
    ]
