import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("temples", "0003_backfill_missing_tables"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="conciergethread",
            name="anonymous_id",
            field=models.CharField(
                max_length=64,
                null=True,
                blank=True,
                db_index=True,
            ),
        ),
        migrations.AlterField(
            model_name="conciergethread",
            name="user",
            field=models.ForeignKey(
                to=settings.AUTH_USER_MODEL,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="concierge_threads",
                null=True,
                blank=True,
            ),
        ),
    ]
