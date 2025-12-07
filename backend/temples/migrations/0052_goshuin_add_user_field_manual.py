# temples/migrations/0052_goshuin_add_user_field_manual.py
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("temples", "0051_conciergeusage"),  # ← .py を付けない・名前もこれでOK
    ]

    operations = [
        migrations.AddField(
            model_name="goshuin",
            name="user",
            field=models.ForeignKey(
                to=settings.AUTH_USER_MODEL,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="goshuin",
                null=True,   # 既存データ保護のため一旦 null/blank 許可
                blank=True,
            ),
        ),
    ]
