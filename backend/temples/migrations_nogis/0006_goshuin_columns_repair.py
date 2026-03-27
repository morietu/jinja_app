# backend/temples/migrations_nogis/0006_goshuin_columns_repair.py

import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("temples", "0005_goshuin_and_goshuinimage"),
    ]

    operations = [
        migrations.AddField(
            model_name="goshuin",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, null=True),
        ),
        migrations.AddField(
            model_name="goshuinimage",
            name="size_bytes",
            field=models.BigIntegerField(default=0),
        ),
    ]
