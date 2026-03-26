# backend/temples/migrations_nogis/0005_goshuin_and_goshuinimage.py

import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("temples", "0004_conciergethread_anonymous_id_and_user_nullable"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Goshuin",
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
                ("title", models.CharField(blank=True, max_length=100)),
                ("is_public", models.BooleanField(default=True)),
                ("likes", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "shrine",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="goshuins",
                        to="temples.shrine",
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="GoshuinImage",
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
                ("image", models.ImageField(upload_to="goshuin/")),
                ("order", models.PositiveIntegerField(default=0)),
                (
                    "goshuin",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="images",
                        to="temples.goshuin",
                    ),
                ),
            ],
            options={
                "ordering": ["order", "id"],
            },
        ),
        migrations.AddIndex(
            model_name="goshuinimage",
            index=models.Index(
                fields=["order"],
                name="temples_gos_order_27aae0_idx",
            ),
        ),
    ]
