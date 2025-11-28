# backend/temples/migrations_nogis/0002_goshuin_shrine.py
# Migration to add shrine FK to Goshuin model in migrations_nogis

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("temples", "0001_initial"),
    ]

    operations = [
        # Add shrine FK to Goshuin
        migrations.AddField(
            model_name="goshuin",
            name="shrine",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="goshuins",
                to="temples.shrine",
                null=False,
                default=1,
            ),
            preserve_default=False,
        ),
    ]
